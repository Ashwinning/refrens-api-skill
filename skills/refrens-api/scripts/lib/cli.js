import path from "node:path";
import {
  credentialPermissionsSafe,
  parseCredentialsFile,
  requireCredentials,
  resolveCredentialsPath
} from "./credentials.js";
import {
  authenticate,
  buildUrl,
  expandPath,
  HttpError,
  loadBodyFile,
  requestJson,
  requireOriginApproval,
  resolveBaseUrl,
  validateEndpoint,
  validateToken,
  confirmationHash
} from "./http.js";
import {
  buildDryRunPreview,
  summarizeRequest
} from "./preview.js";
import { redact, redactPreviewBody } from "./redaction.js";
import {
  buildInvoiceBatchPlan,
  buildInvoiceBatchPreview,
  confirmInvoiceBatch,
  loadInvoiceBatch
} from "./invoice-batch.js";
import {
  loadPersistedToken,
  persistToken,
  resolveTokenCachePath
} from "./token-cache.js";
import { writeJson } from "./utils.js";

const HELP_TEXT = `refrens-api

Safe Refrens API helper for authentication, documented requests, and invoice batches.

Usage:
  refrens-api check [options]
  refrens-api auth [options]
  refrens-api request <GET|POST|PATCH> <path> [options]
  refrens-api invoice-batch <preview|create> --input <file> [options]

Common options:
  --credentials <file>      Credentials file. Default: ./.credentials
  --base-url <url>          Refrens API base URL. Default: https://api.refrens.com
  --approve-origin <url>    Required for live auth and live requests
  --timeout <seconds>       HTTP timeout. Default: 30
  --allow-unsafe-credential-permissions

Request options:
  --body-file <file>        UTF-8 JSON file for POST/PATCH payloads
  --dry-run                 Preview a request and print the confirmation hash
  --confirm-hash <hash>     Required for live POST/PATCH calls
  --use-cached-token        Use the Windows DPAPI token cache
  --persist-token           Persist a freshly issued token to the cache
  --token-cache <file>      Override the token cache path

Invoice batch options:
  --input <file>            JSON file describing one or more invoices
  --reference-invoice-id <id>
                            Fetch invoice defaults from an existing invoice
  --confirm-hash <key=hash> Repeat for every invoice during create

Examples:
  refrens-api check
  refrens-api auth --approve-origin https://api.refrens.com --validate
  refrens-api request GET '/businesses/:urlKey/invoices?$limit=5' --approve-origin https://api.refrens.com
  refrens-api request POST /businesses/:urlKey/invoices --body-file invoice.json --dry-run
  refrens-api invoice-batch preview --input invoice-batch.json
`;

const CHECK_HELP = `${HELP_TEXT}
check:
  Validates the credential file, optional Windows ACL safety, and base URL resolution.
`;

const AUTH_HELP = `${HELP_TEXT}
auth:
  Authenticates with app-secret credentials without printing the bearer token.
  --validate       Also validates the returned token with POST /authentication.
`;

const REQUEST_HELP = `${HELP_TEXT}
request:
  Authenticates, expands :urlKey from credentials, validates the endpoint allowlist,
  supports safe dry-runs, and requires the dry-run confirmation hash for live POST/PATCH.
`;

const INVOICE_BATCH_HELP = `${HELP_TEXT}
invoice-batch:
  Reads a JSON file, optionally applies defaults from a reference invoice,
  previews invoice creation payloads, and creates invoices only after all hashes match.
`;

const COMMON_OPTION_SPEC = {
  "--credentials": "string",
  "--base-url": "string",
  "--approve-origin": "string",
  "--timeout": "string",
  "--allow-unsafe-credential-permissions": "boolean",
  "--help": "boolean",
  "-h": "boolean"
};

const AUTH_OPTION_SPEC = {
  ...COMMON_OPTION_SPEC,
  "--validate": "boolean",
  "--persist-token": "boolean",
  "--token-cache": "string"
};

const REQUEST_OPTION_SPEC = {
  ...COMMON_OPTION_SPEC,
  "--body-file": "string",
  "--dry-run": "boolean",
  "--confirm-hash": "multi",
  "--use-cached-token": "boolean",
  "--persist-token": "boolean",
  "--token-cache": "string"
};

const INVOICE_BATCH_OPTION_SPEC = {
  ...COMMON_OPTION_SPEC,
  "--input": "string",
  "--reference-invoice-id": "string",
  "--confirm-hash": "multi",
  "--use-cached-token": "boolean",
  "--persist-token": "boolean",
  "--token-cache": "string"
};

function parseOptions(args, optionSpec) {
  const options = { _: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-")) {
      options._.push(arg);
      continue;
    }

    const [name, inlineValue] = arg.split("=", 2);
    const type = optionSpec[name];
    if (!type) {
      throw new Error(`Unknown option: ${name}`);
    }

    if (type === "boolean") {
      options[name] = true;
      continue;
    }

    const value =
      inlineValue !== undefined
        ? inlineValue
        : args[index + 1] && !args[index + 1].startsWith("-")
          ? args[++index]
          : null;

    if (value === null) {
      throw new Error(`Option requires a value: ${name}`);
    }

    if (type === "multi") {
      options[name] ??= [];
      options[name].push(value);
      continue;
    }

    options[name] = value;
  }

  return options;
}

function secondsOption(rawValue) {
  if (rawValue === undefined) {
    return 30;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("--timeout must be a positive number");
  }
  return value;
}

function helpRequested(options) {
  return Boolean(options["--help"] || options["-h"]);
}

function ensureCredentialSafety(credentialsPath, options, command) {
  const permissionsSafe = credentialPermissionsSafe(credentialsPath);
  if (
    permissionsSafe === false &&
    !options["--allow-unsafe-credential-permissions"]
  ) {
    if (command === "check") {
      writeJson({
        credentialsFile: credentialsPath,
        credentialPermissionsSafe: false,
        blocked: true,
        reason: "Credential file is writable by a broad Windows principal"
      });
      return { permissionsSafe, blocked: true };
    }

    throw new Error(
      "Credential file permissions are unsafe; restrict broad Modify/Write/Full access or use the one-run override"
    );
  }

  return { permissionsSafe, blocked: false };
}

function loadEnvironment(options, command, { requireSecrets = true } = {}) {
  const credentialsPath = resolveCredentialsPath(options["--credentials"]);
  const safety = ensureCredentialSafety(credentialsPath, options, command);
  if (safety.blocked) {
    return { blocked: true };
  }

  const credentials = parseCredentialsFile(credentialsPath);
  if (requireSecrets) {
    requireCredentials(credentials);
  }

  const { baseUrl, source } = resolveBaseUrl({
    baseUrl: options["--base-url"],
    credentials
  });

  return {
    blocked: false,
    credentialsPath,
    permissionsSafe: safety.permissionsSafe,
    credentials,
    baseUrl,
    baseUrlSource: source,
    timeout: secondsOption(options["--timeout"]),
    tokenCachePath: resolveTokenCachePath(
      options["--token-cache"],
      credentialsPath
    )
  };
}

function parseConfirmationPairs(values = []) {
  const map = {};
  for (const value of values) {
    const [key, hash] = value.split("=", 2);
    if (!key || !hash) {
      throw new Error(
        "--confirm-hash must be repeated as <invoice-key>=<confirmation-hash>"
      );
    }
    map[key] = hash;
  }
  return map;
}

async function resolveTokenForRequest(env, options, { live = true } = {}) {
  if (!live) {
    return null;
  }

  requireOriginApproval(env.baseUrl, options["--approve-origin"]);

  if (options["--use-cached-token"]) {
    return loadPersistedToken(env.tokenCachePath);
  }

  const authResult = await authenticate({
    baseUrl: env.baseUrl,
    credentials: env.credentials,
    timeout: env.timeout,
    approvedOrigin: options["--approve-origin"]
  });

  if (options["--persist-token"]) {
    persistToken(authResult.token, env.tokenCachePath);
  }

  return authResult.token;
}

async function maybeFetchReferenceInvoice(env, options, batchInput) {
  const referenceInvoiceId =
    options["--reference-invoice-id"] ?? batchInput?.referenceInvoice?.invoiceId;

  if (!referenceInvoiceId) {
    return null;
  }

  const requestPath = expandPath(
    `/businesses/:urlKey/invoices/${encodeURIComponent(referenceInvoiceId)}`,
    env.credentials
  );
  validateEndpoint("GET", requestPath);
  const token = await resolveTokenForRequest(env, options);
  const { payload } = await requestJson({
    method: "GET",
    url: buildUrl(env.baseUrl, requestPath),
    token,
    timeout: env.timeout
  });

  return payload?.data ?? payload;
}

async function runCheck(args) {
  const options = parseOptions(args, COMMON_OPTION_SPEC);
  if (helpRequested(options)) {
    process.stdout.write(CHECK_HELP);
    return 0;
  }

  const env = loadEnvironment(options, "check");
  if (env.blocked) {
    return 3;
  }

  writeJson({
    credentialsFile: env.credentialsPath,
    credentialPermissionsSafe: env.permissionsSafe,
    requiredNamesPresent: true,
    urlKeyPresent: Boolean(env.credentials.url_key),
    privateKeyPresent: Boolean(env.credentials.private_key),
    baseUrl: env.baseUrl,
    baseUrlSource: env.baseUrlSource,
    baseUrlValid: true
  });
  return 0;
}

async function runAuth(args) {
  const options = parseOptions(args, AUTH_OPTION_SPEC);
  if (helpRequested(options)) {
    process.stdout.write(AUTH_HELP);
    return 0;
  }

  const env = loadEnvironment(options, "auth");
  if (env.blocked) {
    return 3;
  }

  const authResult = await authenticate({
    baseUrl: env.baseUrl,
    credentials: env.credentials,
    timeout: env.timeout,
    approvedOrigin: options["--approve-origin"]
  });

  const output = {
    authenticated: true,
    baseUrl: env.baseUrl,
    namePresent:
      authResult.payload &&
      typeof authResult.payload === "object" &&
      typeof authResult.payload.name === "string" &&
      authResult.payload.name.trim().length > 0
  };

  if (options["--validate"]) {
    output.validated = await validateToken({
      baseUrl: env.baseUrl,
      token: authResult.token,
      timeout: env.timeout
    });
  }

  if (options["--persist-token"]) {
    persistToken(authResult.token, env.tokenCachePath);
    output.tokenPersisted = true;
    output.tokenCache = env.tokenCachePath;
  }

  writeJson(output);
  return 0;
}

async function runRequest(args) {
  const options = parseOptions(args, REQUEST_OPTION_SPEC);
  if (helpRequested(options)) {
    process.stdout.write(REQUEST_HELP);
    return 0;
  }
  if (options._.length !== 2) {
    throw new Error("request requires <GET|POST|PATCH> and <path>");
  }

  const method = options._[0].toUpperCase();
  const pathValue = options._[1];
  const env = loadEnvironment(options, "request");
  if (env.blocked) {
    return 3;
  }

  const body = options["--body-file"]
    ? loadBodyFile(path.resolve(process.cwd(), options["--body-file"]))
    : undefined;
  const expandedPath = expandPath(pathValue, env.credentials);
  validateEndpoint(method, expandedPath);
  const requestUrl = buildUrl(env.baseUrl, expandedPath);
  const digest = confirmationHash(method, requestUrl, body);
  const previewBody = redactPreviewBody(body);
  const preview = buildDryRunPreview({
    method,
    pathValue,
    body: previewBody,
    summarySourceBody: body,
    confirmationHash: digest
  });

  if (options["--dry-run"]) {
    writeJson(preview);
    return 0;
  }

  if (
    ["POST", "PATCH"].includes(method) &&
    options["--confirm-hash"]?.[0] !== digest
  ) {
    writeJson({
      blocked: true,
      reason:
        "Live POST/PATCH requires the exact --confirm-hash from the approved dry-run",
      ...preview
    });
    return 2;
  }

  let token = await resolveTokenForRequest(env, options);
  let response;
  try {
    response = await requestJson({
      method,
      url: requestUrl,
      body,
      token,
      timeout: env.timeout
    });
  } catch (error) {
    if (
      error instanceof HttpError &&
      error.status === 401 &&
      method === "GET" &&
      options["--use-cached-token"]
    ) {
      const authResult = await authenticate({
        baseUrl: env.baseUrl,
        credentials: env.credentials,
        timeout: env.timeout,
        approvedOrigin: options["--approve-origin"]
      });
      token = authResult.token;
      if (options["--persist-token"]) {
        persistToken(token, env.tokenCachePath);
      }
      response = await requestJson({
        method,
        url: requestUrl,
        body,
        token,
        timeout: env.timeout
      });
    } else {
      throw error;
    }
  }

  writeJson({
    status: response.status,
    summary: summarizeRequest(method, pathValue, body),
    data: redact(response.payload, "", { redactUnknownStrings: true })
  });
  return 0;
}

async function runInvoiceBatch(args) {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(INVOICE_BATCH_HELP);
    return 0;
  }

  const action = args[0];
  const options = parseOptions(args.slice(1), INVOICE_BATCH_OPTION_SPEC);
  if (helpRequested(options)) {
    process.stdout.write(INVOICE_BATCH_HELP);
    return 0;
  }
  if (!["preview", "create"].includes(action)) {
    throw new Error("invoice-batch requires preview or create");
  }
  if (!options["--input"]) {
    throw new Error("invoice-batch requires --input <file>");
  }

  const env = loadEnvironment(options, "invoice-batch");
  if (env.blocked) {
    return 3;
  }

  const batchInput = loadInvoiceBatch(
    path.resolve(process.cwd(), options["--input"])
  );
  const referenceInvoice = await maybeFetchReferenceInvoice(env, options, batchInput);
  const plan = buildInvoiceBatchPlan({
    batchInput,
    baseUrl: env.baseUrl,
    credentials: env.credentials,
    referenceInvoice
  });
  const preview = buildInvoiceBatchPreview(plan);

  if (action === "preview") {
    writeJson(preview);
    return 0;
  }

  const confirmations = parseConfirmationPairs(options["--confirm-hash"]);
  const confirmationResult = confirmInvoiceBatch(plan, confirmations);
  if (!confirmationResult.valid) {
    writeJson({
      blocked: true,
      reason:
        "Every invoice requires the exact confirmation hash from the approved preview",
      missing: confirmationResult.missing,
      mismatched: confirmationResult.mismatched,
      preview
    });
    return 2;
  }

  const token = await resolveTokenForRequest(env, options);
  const created = [];

  for (const invoice of plan.invoices) {
    try {
      const response = await requestJson({
        method: "POST",
        url: invoice.requestUrl,
        body: invoice.payload,
        token,
        timeout: env.timeout
      });
      created.push({
        key: invoice.key,
        status: response.status,
        data: redact(response.payload, "", { redactUnknownStrings: true })
      });
    } catch (error) {
      writeJson({
        partial: created.length > 0,
        created,
        failedInvoice: invoice.key,
        error: error instanceof Error ? error.message : String(error)
      });
      return 1;
    }
  }

  writeJson({
    created
  });
  return 0;
}

export async function runCli(argv = process.argv.slice(2)) {
  try {
    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
      process.stdout.write(HELP_TEXT);
      return 0;
    }

    const [command, ...args] = argv;
    switch (command) {
      case "check":
        return await runCheck(args);
      case "auth":
        return await runAuth(args);
      case "request":
        return await runRequest(args);
      case "invoice-batch":
        return await runInvoiceBatch(args);
      case "help":
        process.stdout.write(HELP_TEXT);
        return 0;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
