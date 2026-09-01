import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DEFAULT_BASE_URL,
  ENDPOINTS,
  MAX_BODY_BYTES,
  MAX_RESPONSE_BYTES
} from "./constants.js";
import { redact, redactPath } from "./redaction.js";
import { stableStringify } from "./utils.js";

export class HttpError extends Error {
  constructor(status, payload) {
    const safePayload = redact(payload, "", { redactUnknownStrings: true });
    super(`HTTP ${status}: ${JSON.stringify(safePayload)}`);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export function resolveBaseUrl({ baseUrl, credentials = {} } = {}) {
  const selected =
    baseUrl ??
    process.env.REFRENS_API_BASE_URL ??
    credentials.base_url ??
    DEFAULT_BASE_URL;

  const source =
    baseUrl !== undefined
      ? "argument"
      : process.env.REFRENS_API_BASE_URL
        ? "environment"
        : credentials.base_url
          ? "credentials"
          : "default";

  let parsed;
  try {
    parsed = new URL(selected);
  } catch {
    throw new Error(`Invalid base URL: ${selected}`);
  }

  if (
    parsed.protocol !== "https:" ||
    !parsed.host ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "Base URL must be an HTTPS origin or HTTPS base path without query or fragment"
    );
  }

  return {
    baseUrl: selected.replace(/\/+$/, ""),
    source
  };
}

export function originFor(baseUrl) {
  return new URL(baseUrl).origin;
}

export function requireOriginApproval(baseUrl, approvedOrigin) {
  const origin = originFor(baseUrl);
  if (!approvedOrigin || approvedOrigin.replace(/\/+$/, "") !== origin) {
    throw new Error(
      `Live authentication and requests require --approve-origin ${origin}`
    );
  }
}

export function buildUrl(baseUrl, requestPath) {
  if (!requestPath.startsWith("/")) {
    throw new Error(
      "Request path must be a documented absolute path such as /businesses/..."
    );
  }

  const parsed = new URL(requestPath, "https://placeholder.invalid");
  if (parsed.origin !== "https://placeholder.invalid") {
    throw new Error(
      "Request path must be relative to the Refrens API, not a full URL"
    );
  }

  return `${baseUrl.replace(/\/+$/, "")}${requestPath}`;
}

export function expandPath(pathValue, credentials) {
  if (!pathValue.includes(":urlKey")) {
    return pathValue;
  }

  if (!credentials.url_key) {
    throw new Error("Credential url_key is required for a :urlKey path");
  }

  return pathValue.replaceAll(
    ":urlKey",
    encodeURIComponent(credentials.url_key)
  );
}

export function validateEndpoint(method, requestPath) {
  const route = new URL(requestPath, "https://placeholder.invalid").pathname;
  const allowed = ENDPOINTS[method] ?? [];
  if (!allowed.some((pattern) => pattern.test(route))) {
    throw new Error(
      `Method/path is not in the documented endpoint allowlist: ${method} ${redactPath(requestPath)}`
    );
  }
}

export function loadBodyFile(filePath) {
  const raw = readFileSync(filePath);
  if (raw.length > MAX_BODY_BYTES) {
    throw new Error(`JSON body exceeds safe size limit: ${filePath}`);
  }
  return JSON.parse(raw.toString("utf8"));
}

export function confirmationHash(method, requestUrl, body) {
  const canonical = stableStringify({ method, requestUrl, body });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

export async function requestJson({
  method,
  url,
  body,
  token,
  timeout = 30
}) {
  const headers = {
    Accept: "application/json"
  };

  let requestBody;
  if (body !== undefined) {
    requestBody = JSON.stringify(body);
    if (Buffer.byteLength(requestBody, "utf8") > MAX_BODY_BYTES) {
      throw new Error("Serialized JSON body exceeds safe size limit");
    }
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      redirect: "manual",
      signal: AbortSignal.timeout(timeout * 1000)
    });
  } catch (error) {
    const reason =
      error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "request timed out"
        : error?.message ?? String(error);
    throw new Error(`Network request failed: ${reason}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_RESPONSE_BYTES) {
    throw new Error("Response exceeded safe size limit");
  }

  const rawText = buffer.toString("utf8");
  let payload = null;
  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { message: "Non-JSON response omitted" };
    }
  }

  if (!response.ok) {
    throw new HttpError(response.status, payload);
  }

  return {
    status: response.status,
    payload
  };
}

export async function authenticate({
  baseUrl,
  credentials,
  timeout,
  approvedOrigin
}) {
  requireOriginApproval(baseUrl, approvedOrigin);

  const { payload } = await requestJson({
    method: "POST",
    url: buildUrl(baseUrl, "/authentication"),
    body: {
      strategy: "app-secret",
      appId: credentials.app_id,
      appSecret: credentials.app_secret
    },
    timeout
  });

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.accessToken !== "string" ||
    !payload.accessToken.trim()
  ) {
    throw new Error("Authentication response did not contain accessToken");
  }

  return {
    token: payload.accessToken,
    payload
  };
}

export async function validateToken({ baseUrl, token, timeout }) {
  const { status } = await requestJson({
    method: "POST",
    url: buildUrl(baseUrl, "/authentication"),
    body: {
      strategy: "app-token"
    },
    token,
    timeout
  });

  return status >= 200 && status < 300;
}
