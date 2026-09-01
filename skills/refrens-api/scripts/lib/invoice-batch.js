import {
  DEFAULT_INVOICE_PATH,
  DEFAULT_REFERENCE_INVOICE_FIELDS,
  DEFAULT_REFERENCE_ITEM_FIELDS,
  MAX_BODY_BYTES
} from "./constants.js";
import {
  buildUrl,
  confirmationHash,
  expandPath,
  validateEndpoint
} from "./http.js";
import { summarizeRequest } from "./preview.js";
import { redactPreviewBody, redactPath } from "./redaction.js";
import {
  cloneJson,
  deepMerge,
  isPlainObject,
  omit,
  readJsonFile
} from "./utils.js";

function keyForInvoice(invoice, index) {
  if (typeof invoice.key === "string" && invoice.key.trim()) {
    return invoice.key.trim();
  }
  if (typeof invoice.invoiceNumber === "string" && invoice.invoiceNumber.trim()) {
    return invoice.invoiceNumber.trim();
  }
  return `invoice-${index + 1}`;
}

function validateRequiredInvoiceFields(key, payload) {
  if (typeof payload.invoiceDate !== "string" || !payload.invoiceDate.trim()) {
    throw new Error(`Invoice ${key} requires invoiceDate`);
  }

  if (
    !isPlainObject(payload.billedTo) ||
    typeof payload.billedTo.name !== "string" ||
    !payload.billedTo.name.trim() ||
    typeof payload.billedTo.country !== "string" ||
    !payload.billedTo.country.trim()
  ) {
    throw new Error(`Invoice ${key} requires billedTo.name and billedTo.country`);
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error(`Invoice ${key} requires at least one item`);
  }

  payload.items.forEach((item, itemIndex) => {
    if (!isPlainObject(item)) {
      throw new Error(`Invoice ${key} item ${itemIndex + 1} must be an object`);
    }
    if (typeof item.name !== "string" || !item.name.trim()) {
      throw new Error(`Invoice ${key} item ${itemIndex + 1} requires name`);
    }
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      throw new Error(
        `Invoice ${key} item ${itemIndex + 1} requires quantity > 0`
      );
    }
    if (!Number.isFinite(Number(item.rate)) || Number(item.rate) < 0) {
      throw new Error(`Invoice ${key} item ${itemIndex + 1} requires rate >= 0`);
    }
  });
}

function extractReferenceDefaults(referenceInvoice, referenceConfig) {
  if (!isPlainObject(referenceInvoice)) {
    return { invoiceDefaults: {}, itemDefaults: {} };
  }

  const invoiceFieldNames =
    Array.isArray(referenceConfig.copyInvoiceFields) &&
    referenceConfig.copyInvoiceFields.length > 0
      ? referenceConfig.copyInvoiceFields
      : DEFAULT_REFERENCE_INVOICE_FIELDS;

  const itemFieldNames =
    Array.isArray(referenceConfig.copyItemFields) &&
    referenceConfig.copyItemFields.length > 0
      ? referenceConfig.copyItemFields
      : DEFAULT_REFERENCE_ITEM_FIELDS;

  const itemIndex =
    Number.isInteger(referenceConfig.referenceItemIndex) &&
    referenceConfig.referenceItemIndex >= 0
      ? referenceConfig.referenceItemIndex
      : 0;

  const invoiceDefaults = {};
  for (const fieldName of invoiceFieldNames) {
    if (referenceInvoice[fieldName] !== undefined) {
      invoiceDefaults[fieldName] = cloneJson(referenceInvoice[fieldName]);
    }
  }

  const referenceItem = Array.isArray(referenceInvoice.items)
    ? referenceInvoice.items[itemIndex]
    : undefined;

  const itemDefaults = {};
  if (isPlainObject(referenceItem)) {
    for (const fieldName of itemFieldNames) {
      if (referenceItem[fieldName] !== undefined) {
        itemDefaults[fieldName] = cloneJson(referenceItem[fieldName]);
      }
    }
  }

  return {
    invoiceDefaults,
    itemDefaults,
    referenceItemIndex: itemIndex
  };
}

export function loadInvoiceBatch(filePath) {
  return readJsonFile(filePath, MAX_BODY_BYTES);
}

export function buildInvoiceBatchPlan({
  batchInput,
  baseUrl,
  credentials,
  referenceInvoice = null
}) {
  if (!isPlainObject(batchInput)) {
    throw new Error("Invoice batch input must be a JSON object");
  }
  if (!Array.isArray(batchInput.invoices) || batchInput.invoices.length === 0) {
    throw new Error("Invoice batch input requires a non-empty invoices array");
  }

  const defaults = isPlainObject(batchInput.defaults)
    ? cloneJson(batchInput.defaults)
    : {};
  const basePathTemplate =
    typeof defaults.path === "string" && defaults.path.trim()
      ? defaults.path
      : DEFAULT_INVOICE_PATH;
  const batchItemDefaults = isPlainObject(defaults.itemDefaults)
    ? cloneJson(defaults.itemDefaults)
    : {};
  delete defaults.path;
  delete defaults.itemDefaults;

  const referenceConfig = isPlainObject(batchInput.referenceInvoice)
    ? batchInput.referenceInvoice
    : {};
  const referenceDefaults = extractReferenceDefaults(
    referenceInvoice,
    referenceConfig
  );
  const invoiceDefaults = deepMerge(referenceDefaults.invoiceDefaults, defaults);
  const itemDefaults = deepMerge(referenceDefaults.itemDefaults, batchItemDefaults);

  const usedKeys = new Set();
  const invoices = batchInput.invoices.map((invoice, index) => {
    if (!isPlainObject(invoice)) {
      throw new Error(`Invoice entry ${index + 1} must be an object`);
    }

    const key = keyForInvoice(invoice, index);
    if (usedKeys.has(key)) {
      throw new Error(`Duplicate invoice key detected: ${key}`);
    }
    usedKeys.add(key);

    const requestPathTemplate =
      typeof invoice.requestPath === "string" && invoice.requestPath.trim()
        ? invoice.requestPath
        : basePathTemplate;
    const invoiceOverrides = omit(invoice, ["key", "items", "requestPath"]);
    const payload = deepMerge(invoiceDefaults, invoiceOverrides);
    const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
    payload.items = invoiceItems.map((item) => deepMerge(itemDefaults, item));
    validateRequiredInvoiceFields(key, payload);

    const expandedPath = expandPath(requestPathTemplate, credentials);
    validateEndpoint("POST", expandedPath);
    const requestUrl = buildUrl(baseUrl, expandedPath);
    const digest = confirmationHash("POST", requestUrl, payload);

    return {
      key,
      pathTemplate: requestPathTemplate,
      requestPath: expandedPath,
      requestUrl,
      payload,
      confirmationHash: digest,
      redactedBody: redactPreviewBody(payload),
      summary: summarizeRequest("POST", requestPathTemplate, payload)
    };
  });

  return {
    basePathTemplate,
    referenceInvoice:
      referenceInvoice && isPlainObject(referenceInvoice)
        ? {
            invoiceId:
              typeof referenceInvoice._id === "string"
                ? referenceInvoice._id
                : typeof referenceConfig.invoiceId === "string"
                  ? referenceConfig.invoiceId
                  : null,
            copiedInvoiceFields:
              Array.isArray(referenceConfig.copyInvoiceFields) &&
              referenceConfig.copyInvoiceFields.length > 0
                ? referenceConfig.copyInvoiceFields
                : DEFAULT_REFERENCE_INVOICE_FIELDS,
            copiedItemFields:
              Array.isArray(referenceConfig.copyItemFields) &&
              referenceConfig.copyItemFields.length > 0
                ? referenceConfig.copyItemFields
                : DEFAULT_REFERENCE_ITEM_FIELDS,
            referenceItemIndex: referenceDefaults.referenceItemIndex
          }
        : null,
    invoices
  };
}

export function buildInvoiceBatchPreview(plan) {
  return {
    dryRun: true,
    path: redactPath(plan.basePathTemplate),
    referenceInvoice: plan.referenceInvoice,
    invoices: plan.invoices.map((invoice) => ({
      key: invoice.key,
      path: redactPath(invoice.pathTemplate),
      confirmationHash: invoice.confirmationHash,
      body: invoice.redactedBody,
      summary: invoice.summary
    }))
  };
}

export function confirmInvoiceBatch(plan, confirmations) {
  const missing = [];
  const mismatched = [];

  for (const invoice of plan.invoices) {
    const supplied = confirmations[invoice.key];
    if (!supplied) {
      missing.push(invoice.key);
      continue;
    }
    if (supplied !== invoice.confirmationHash) {
      mismatched.push(invoice.key);
    }
  }

  return {
    valid: missing.length === 0 && mismatched.length === 0,
    missing,
    mismatched
  };
}
