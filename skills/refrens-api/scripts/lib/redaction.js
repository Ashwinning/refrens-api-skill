import {
  SAFE_PREVIEW_STRING_KEYS,
  SAFE_RESPONSE_STRING_KEYS,
  SENSITIVE_FRAGMENTS
} from "./constants.js";

export function redact(
  value,
  key = "",
  { redactUnknownStrings = false, safeStringKeys = SAFE_RESPONSE_STRING_KEYS } = {}
) {
  const normalizedKey = key.replaceAll("-", "").replaceAll("_", "").toLowerCase();

  if (SENSITIVE_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment))) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      redact(entry, key, { redactUnknownStrings, safeStringKeys })
    );
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey, { redactUnknownStrings, safeStringKeys })
      ])
    );
  }

  if (
    redactUnknownStrings &&
    typeof value === "string" &&
    !safeStringKeys.has(key)
  ) {
    return "[REDACTED]";
  }

  return value;
}

export function redactPath(pathValue) {
  const safeQueryNames = new Set([
    "$limit",
    "$skip",
    "cancelPayment",
    "includePaymentDetails"
  ]);

  const [rawPath, rawQuery = ""] = pathValue.split("?", 2);
  const safePath = rawPath.replace(
    /\/businesses\/[^/?]+/i,
    "/businesses/[REDACTED_URL_KEY]"
  );

  if (!rawQuery) {
    return safePath;
  }

  const params = new URLSearchParams(rawQuery);
  const sanitized = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    sanitized.set(
      key,
      safeQueryNames.has(key) || key.startsWith("$sort[") ? value : "[REDACTED]"
    );
  }

  return `${safePath}?${sanitized.toString()}`;
}

export function redactPreviewBody(body) {
  return redact(body, "", {
    redactUnknownStrings: true,
    safeStringKeys: SAFE_PREVIEW_STRING_KEYS
  });
}
