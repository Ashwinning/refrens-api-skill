import path from "node:path";
import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { DEFAULT_BASE_URL } from "./constants.js";
import {
  credentialsFileExists,
  credentialPermissionsSafe,
  parseCredentialsFile,
  requireCredentials,
  resolveCredentialsPath,
  writeCredentialsFile
} from "./credentials.js";
import {
  authenticate,
  buildUrl,
  expandPath,
  HttpError,
  loadBodyFile,
  originFor,
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
  refrens-api setup [options]
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

Setup options:
  --overwrite               Replace an existing credentials file

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
  refrens-api setup
  refrens-api check
  refrens-api auth --approve-origin https://api.refrens.com --validate
  refrens-api request GET '/businesses/:urlKey/invoices?$limit=5' --approve-origin https://api.refrens.com
  refrens-api request POST /businesses/:urlKey/invoices --body-file invoice.json --dry-run
  refrens-api invoice-batch preview --input invoice-batch.json
`;

const CREDENTIALS_GUIDE_URL =
  "https://github.com/Ashwinning/refrens-api-skill/blob/main/skills/refrens-api/references/getting-credentials.md";

const SETUP_HELP = `${HELP_TEXT}
setup:
  Interactively writes a .credentials file by asking for app_id, app_secret,
  url_key, and the base URL one field at a time.
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

const SETUP_OPTION_SPEC = {
  "--credentials": "string",
  "--base-url": "string",
  "--overwrite": "boolean",
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

class PromptOutput extends Writable {
  constructor(output) {
    super();
    this.output = output;
    this.muted = false;
  }

  _write(chunk, encoding, callback) {
    if (!this.muted) {
      this.output.write(chunk, encoding);
    }
    callback();
  }
}

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

function interactivePromptsAvailable() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function resolveSetupDefaults(baseUrl) {
  return {
    appId: process.env.REFRENS_SETUP_APP_ID?.trim() || "",
    appSecret: process.env.REFRENS_SETUP_APP_SECRET?.trim() || "",
    urlKey: process.env.REFRENS_SETUP_URL_KEY?.trim() || "",
    baseUrl:
      process.env.REFRENS_SETUP_BASE_URL?.trim() ||
      baseUrl ||
      DEFAULT_BASE_URL
  };
}

function missingCredentialsMessage(credentialsPath) {
  return `Credentials file not found: ${credentialsPath}. Run \`refrens-api setup\` to create it interactively, or follow the guide at ${CREDENTIALS_GUIDE_URL}`;
}

async function promptText(reader, output, label, {
  defaultValue,
  required = true,
  secret = false
} = {}) {
  while (true) {
    const promptSuffix =
      defaultValue !== undefined && defaultValue !== ""
        ? ` [${defaultValue}]`
        : "";
    output.muted = secret;
    const answer = await reader.question(`${label}${promptSuffix}: `);
    output.muted = false;
    if (secret) {
      process.stdout.write("\n");
    }

    const value = answer.trim() || (defaultValue ?? "");
    if (!required || value) {
      return value;
    }

    process.stdout.write("A value is required.\n");
  }
}

async function promptConfirm(reader, label, { defaultValue = false } = {}) {
  const defaultHint = defaultValue ? "Y/n" : "y/N";
  while (true) {
    const answer = (await reader.question(`${label} [${defaultHint}]: `))
      .trim()
      .toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    if (["y", "yes"].includes(answer)) {
      return true;
    }
    if (["n", "no"].includes(answer)) {
      return false;
    }
    process.stdout.write("Please answer yes or no.\n");
  }
}

async function collectInteractiveCredentials({
  credentialsPath,
  baseUrl,
  overwrite = false
}) {
  const defaults = resolveSetupDefaults(baseUrl);
  const canPrompt = interactivePromptsAvailable();
  const hasPrefilledRequiredValues = Boolean(
    defaults.appId && defaults.appSecret && defaults.urlKey
  );

  if (!canPrompt && !hasPrefilledRequiredValues) {
    throw new Error(
      "Interactive setup requires a terminal. For automated setup, provide REFRENS_SETUP_APP_ID, REFRENS_SETUP_APP_SECRET, and REFRENS_SETUP_URL_KEY."
    );
  }

  if (credentialsFileExists(credentialsPath) && !overwrite && !canPrompt) {
    throw new Error(
      `Credentials file already exists: ${credentialsPath}. Re-run with --overwrite to replace it.`
    );
  }

  if (!canPrompt && hasPrefilledRequiredValues) {
    writeCredentialsFile(
      credentialsPath,
      {
        app_id: defaults.appId,
        app_secret: defaults.appSecret,
        url_key: defaults.urlKey,
        base_url: defaults.baseUrl
      },
      { overwrite }
    );

    const permissionsSafe = credentialPermissionsSafe(credentialsPath);
    return {
      aborted: false,
      credentialsFile: credentialsPath,
      baseUrl: defaults.baseUrl,
      approveOrigin: originFor(defaults.baseUrl),
      guideUrl: CREDENTIALS_GUIDE_URL,
      credentialPermissionsSafe: permissionsSafe
    };
  }

  process.stdout.write(
    `Interactive Refrens setup\nGuide: ${CREDENTIALS_GUIDE_URL}\n\n`
  );

  const promptOutput = new PromptOutput(process.stdout);
  const reader = readline.createInterface({
    input: process.stdin,
    output: promptOutput,
    terminal: true
  });

  try {
    if (credentialsFileExists(credentialsPath) && !overwrite) {
      const confirmed = await promptConfirm(
        reader,
        `Replace the existing credentials file at ${credentialsPath}?`,
        { defaultValue: false }
      );
      if (!confirmed) {
        return {
          aborted: true,
          credentialsFile: credentialsPath
        };
      }
    }

    const appId =
      defaults.appId ||
      (await promptText(reader, promptOutput, "App ID"));
    const appSecret =
      defaults.appSecret ||
      (await promptText(reader, promptOutput, "App Secret", {
        secret: true
      }));
    const urlKey =
      defaults.urlKey ||
      (await promptText(reader, promptOutput, "Business URL Key"));
    const resolvedBaseUrl = await promptText(
      reader,
      promptOutput,
      "Base URL",
      {
        defaultValue: defaults.baseUrl
      }
    );

    writeCredentialsFile(
      credentialsPath,
      {
        app_id: appId,
        app_secret: appSecret,
        url_key: urlKey,
        base_url: resolvedBaseUrl
      },
      { overwrite: true }
    );

    const permissionsSafe = credentialPermissionsSafe(credentialsPath);
    return {
      aborted: false,
      credentialsFile: credentialsPath,
      baseUrl: resolvedBaseUrl,
      approveOrigin: originFor(resolvedBaseUrl),
      guideUrl: CREDENTIALS_GUIDE_URL,
      credentialPermissionsSafe: permissionsSafe
    };
  } finally {
    reader.close();
  }
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

async function ensureCredentialsFile(credentialsPath, baseUrl) {
  if (credentialsFileExists(credentialsPath)) {
    return null;
  }

  if (!interactivePromptsAvailable()) {
    throw new Error(missingCredentialsMessage(credentialsPath));
  }

  const setupResult = await collectInteractiveCredentials({
    credentialsPath,
    baseUrl
  });
  if (setupResult.aborted) {
    throw new Error(`Credentials setup was canceled: ${credentialsPath}`);
  }
  return setupResult;
}

async function loadEnvironment(options, command, { requireSecrets = true } = {}) {
  const credentialsPath = resolveCredentialsPath(options["--credentials"]);
  const setupResult = await ensureCredentialsFile(
    credentialsPath,
    options["--base-url"]
  );
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
    setupResult,
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

async function runSetup(args) {
  const options = parseOptions(args, SETUP_OPTION_SPEC);
  if (helpRequested(options)) {
    process.stdout.write(SETUP_HELP);
    return 0;
  }

  const credentialsPath = resolveCredentialsPath(options["--credentials"]);
  const setupResult = await collectInteractiveCredentials({
    credentialsPath,
    baseUrl: options["--base-url"],
    overwrite: Boolean(options["--overwrite"])
  });

  if (setupResult.aborted) {
    writeJson(setupResult);
    return 2;
  }

  writeJson({
    setupComplete: true,
    credentialsFile: setupResult.credentialsFile,
    baseUrl: setupResult.baseUrl,
    approveOrigin: setupResult.approveOrigin,
    guideUrl: setupResult.guideUrl,
    credentialPermissionsSafe: setupResult.credentialPermissionsSafe,
    nextCommands: {
      check: `refrens-api check --credentials ${setupResult.credentialsFile}`,
      auth: `refrens-api auth --credentials ${setupResult.credentialsFile} --approve-origin ${setupResult.approveOrigin} --validate`
    }
  });
  return 0;
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

  const env = await loadEnvironment(options, "check");
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

  const env = await loadEnvironment(options, "auth");
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
  const env = await loadEnvironment(options, "request");
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

  const env = await loadEnvironment(options, "invoice-batch");
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
      case "setup":
        return await runSetup(args);
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
