import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceBatchPlan,
  buildInvoiceBatchPreview,
  confirmInvoiceBatch
} from "../skills/refrens-api/scripts/lib/invoice-batch.js";

test("buildInvoiceBatchPlan applies defaults and expands request paths", () => {
  const plan = buildInvoiceBatchPlan({
    batchInput: {
      defaults: {
        path: "/businesses/:urlKey/invoices",
        currency: "INR",
        invoiceType: "INVOICE",
        billedTo: {
          name: "Acme Pvt Ltd",
          country: "IN"
        },
        itemDefaults: {
          name: "Professional Services",
          rate: 25000,
          gstRate: 18
        }
      },
      invoices: [
        {
          key: "aug-2026",
          invoiceNumber: "INV-001",
          invoiceDate: "2026-08-31",
          items: [
            {
              description: "Implementation sprint",
              quantity: 2
            }
          ]
        }
      ]
    },
    baseUrl: "https://api.refrens.com",
    credentials: {
      url_key: "demo"
    }
  });

  assert.equal(plan.invoices[0].requestPath, "/businesses/demo/invoices");
  assert.equal(plan.invoices[0].payload.items[0].name, "Professional Services");
  assert.equal(plan.invoices[0].summary.money.subtotal, 50000);

  const preview = buildInvoiceBatchPreview(plan);
  assert.equal(preview.invoices[0].body.billedTo.name, "[REDACTED]");
  assert.equal(preview.invoices[0].summary.parties.billedTo.name, "Acme Pvt Ltd");
});

test("buildInvoiceBatchPlan can inherit defaults from a reference invoice", () => {
  const plan = buildInvoiceBatchPlan({
    batchInput: {
      referenceInvoice: {
        invoiceId: "ref-1",
        copyInvoiceFields: ["currency", "billedBy", "billedTo"],
        copyItemFields: ["name", "rate"],
        referenceItemIndex: 0
      },
      defaults: {
        itemDefaults: {
          gstRate: 18
        }
      },
      invoices: [
        {
          key: "sept-2026",
          invoiceDate: "2026-09-30",
          items: [
            {
              description: "Monthly support",
              quantity: 1
            }
          ]
        }
      ]
    },
    baseUrl: "https://api.refrens.com",
    credentials: {
      url_key: "demo"
    },
    referenceInvoice: {
      _id: "ref-1",
      currency: "USD",
      billedBy: {
        name: "Example Agency",
        country: "US"
      },
      billedTo: {
        name: "Client Co",
        country: "US"
      },
      items: [
        {
          name: "Consulting",
          rate: 400,
          gstRate: 0
        }
      ]
    }
  });

  const payload = plan.invoices[0].payload;
  assert.equal(payload.currency, "USD");
  assert.equal(payload.items[0].name, "Consulting");
  assert.equal(payload.items[0].rate, 400);
  assert.equal(payload.items[0].gstRate, 18);
});

test("confirmInvoiceBatch reports missing and mismatched hashes", () => {
  const plan = buildInvoiceBatchPlan({
    batchInput: {
      defaults: {
        billedTo: {
          name: "Acme",
          country: "IN"
        },
        itemDefaults: {
          name: "Services",
          rate: 100
        }
      },
      invoices: [
        {
          key: "one",
          invoiceDate: "2026-10-01",
          items: [{ quantity: 1 }]
        },
        {
          key: "two",
          invoiceDate: "2026-10-02",
          items: [{ quantity: 2 }]
        }
      ]
    },
    baseUrl: "https://api.refrens.com",
    credentials: {
      url_key: "demo"
    }
  });

  const result = confirmInvoiceBatch(plan, {
    one: plan.invoices[0].confirmationHash,
    two: "wrong"
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.mismatched, ["two"]);
});
