export const DEFAULT_BASE_URL = "https://api.refrens.com";
export const DEFAULT_CREDENTIALS_FILE = ".credentials";
export const DEFAULT_TOKEN_CACHE = ".refrens-token.dpapi";
export const DEFAULT_INVOICE_PATH = "/businesses/:urlKey/invoices";

export const MAX_BODY_BYTES = 2_000_000;
export const MAX_RESPONSE_BYTES = 5_000_000;

export const SENSITIVE_FRAGMENTS = [
  "accesstoken",
  "address",
  "appid",
  "appsecret",
  "authorization",
  "bank",
  "email",
  "gstin",
  "iban",
  "pan",
  "password",
  "phone",
  "pincode",
  "private",
  "secret",
  "street",
  "swift",
  "taxid",
  "token",
  "urlkey"
];

export const SAFE_RESPONSE_STRING_KEYS = new Set([
  "_id",
  "className",
  "clientId",
  "code",
  "country",
  "currency",
  "expenseNumber",
  "externalId",
  "invoiceId",
  "invoiceNumber",
  "invoiceType",
  "leadId",
  "paymentId",
  "paymentMethod",
  "refId",
  "status"
]);

export const SAFE_PREVIEW_STRING_KEYS = new Set([
  ...SAFE_RESPONSE_STRING_KEYS,
  "clientRequestId",
  "invoiceDate",
  "method",
  "pipeline",
  "stage"
]);

export const ENDPOINTS = {
  GET: [
    /^\/businesses\/[^/?]+\/invoices$/,
    /^\/businesses\/[^/?]+\/invoices\/[^/?]+$/,
    /^\/businesses\/[^/?]+\/invoices\/[^/?]+\/payments$/,
    /^\/api\/v1\/businesses\/[^/?]+\/leads$/,
    /^\/api\/v1\/businesses\/[^/?]+\/clients\/[^/?]+$/
  ],
  POST: [
    /^\/businesses$/,
    /^\/businesses\/[^/?]+\/expenditures$/,
    /^\/businesses\/[^/?]+\/invoices$/,
    /^\/businesses\/[^/?]+\/invoices\/[^/?]+\/irn$/,
    /^\/businesses\/[^/?]+\/invoices\/[^/?]+\/payments$/,
    /^\/api\/v1\/businesses\/[^/?]+\/leads$/,
    /^\/api\/v1\/businesses\/[^/?]+\/clients$/
  ],
  PATCH: [
    /^\/businesses\/[^/?]+\/invoices\/[^/?]+$/,
    /^\/api\/v1\/businesses\/[^/?]+\/leads\/[^/?]+$/
  ]
};

export const DEFAULT_REFERENCE_INVOICE_FIELDS = [
  "currency",
  "invoiceType",
  "billedBy",
  "billedTo"
];

export const DEFAULT_REFERENCE_ITEM_FIELDS = [
  "name",
  "rate",
  "gstRate"
];
