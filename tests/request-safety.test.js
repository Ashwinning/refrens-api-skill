import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUrl,
  confirmationHash,
  expandPath,
  resolveBaseUrl,
  validateEndpoint
} from "../skills/refrens-api/scripts/lib/http.js";
import { buildDryRunPreview } from "../skills/refrens-api/scripts/lib/preview.js";
import { redactPath, redactPreviewBody } from "../skills/refrens-api/scripts/lib/redaction.js";

test("resolveBaseUrl falls back to the documented default", () => {
  const result = resolveBaseUrl({ credentials: {} });
  assert.equal(result.baseUrl, "https://api.refrens.com");
  assert.equal(result.source, "default");
});

test("expandPath substitutes and encodes :urlKey", () => {
  const expanded = expandPath("/businesses/:urlKey/invoices", {
    url_key: "demo business"
  });
  assert.equal(expanded, "/businesses/demo%20business/invoices");
});

test("validateEndpoint allows documented routes and rejects unsupported ones", () => {
  assert.doesNotThrow(() =>
    validateEndpoint("GET", "/businesses/demo/invoices")
  );
  assert.throws(
    () => validateEndpoint("DELETE", "/businesses/demo/invoices"),
    /allowlist/
  );
  assert.throws(
    () => validateEndpoint("GET", "/businesses/demo/clients"),
    /allowlist/
  );
});

test("confirmationHash is stable regardless of object key order", () => {
  const first = confirmationHash("POST", "https://api.refrens.com/businesses/demo/invoices", {
    invoiceDate: "2026-08-31",
    items: [
      {
        rate: 25000,
        quantity: 1,
        name: "Services"
      }
    ],
    billedTo: {
      country: "IN",
      name: "Acme"
    }
  });

  const second = confirmationHash("POST", "https://api.refrens.com/businesses/demo/invoices", {
    billedTo: {
      name: "Acme",
      country: "IN"
    },
    items: [
      {
        name: "Services",
        quantity: 1,
        rate: 25000
      }
    ],
    invoiceDate: "2026-08-31"
  });

  assert.equal(first, second);
});

test("dry-run preview keeps summary readable while redacting the body", () => {
  const body = {
    invoiceNumber: "INV-001",
    invoiceDate: "2026-08-31",
    currency: "INR",
    billedTo: {
      name: "Acme Pvt Ltd",
      country: "IN",
      email: "finance@example.com"
    },
    items: [
      {
        name: "Professional Services",
        description: "Implementation sprint",
        quantity: 2,
        rate: 25000
      }
    ]
  };

  const preview = buildDryRunPreview({
    method: "POST",
    pathValue: "/businesses/:urlKey/invoices",
    body: redactPreviewBody(body),
    summarySourceBody: body,
    confirmationHash: confirmationHash(
      "POST",
      buildUrl("https://api.refrens.com", "/businesses/demo/invoices"),
      body
    )
  });

  assert.equal(preview.summary.parties.billedTo.name, "Acme Pvt Ltd");
  assert.equal(preview.body.billedTo.name, "[REDACTED]");
  assert.match(redactPath("/businesses/demo/invoices?$limit=5&email=a@b.com"), /\[REDACTED_URL_KEY\]/);
});
