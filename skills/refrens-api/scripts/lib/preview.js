import { redactPath } from "./redaction.js";
import { roundMoney } from "./utils.js";

function getRoute(pathValue) {
  return new URL(pathValue, "https://placeholder.invalid").pathname;
}

function countEmailRecipients(emailBlock) {
  if (!emailBlock || typeof emailBlock !== "object") {
    return 0;
  }

  const maybeArrays = ["to", "cc", "bcc"];
  return maybeArrays.reduce((total, key) => {
    const value = emailBlock[key];
    return total + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function getItemTotals(items) {
  if (!Array.isArray(items)) {
    return { itemCount: 0, subtotal: 0, totalQuantity: 0 };
  }

  const subtotal = items.reduce((total, item) => {
    const quantity = Number(item?.quantity ?? 0);
    const rate = Number(item?.rate ?? 0);
    return total + quantity * rate;
  }, 0);

  const totalQuantity = items.reduce(
    (total, item) => total + Number(item?.quantity ?? 0),
    0
  );

  return {
    itemCount: items.length,
    subtotal: roundMoney(subtotal),
    totalQuantity: roundMoney(totalQuantity)
  };
}

function partySummary(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const output = {};
  if (typeof value.name === "string" && value.name.trim()) {
    output.name = value.name;
  }
  if (typeof value.country === "string" && value.country.trim()) {
    output.country = value.country;
  }
  return Object.keys(output).length > 0 ? output : null;
}

function basicSummary(method, pathValue, body) {
  return {
    resource: `${method} ${getRoute(pathValue)}`,
    bodyKeys:
      body && typeof body === "object" && !Array.isArray(body)
        ? Object.keys(body)
        : []
  };
}

function summarizeInvoiceCreate(body) {
  const totals = getItemTotals(body?.items);
  return {
    resource: "invoice.create",
    identifiers: {
      invoiceNumber:
        typeof body?.invoiceNumber === "string" ? body.invoiceNumber : "(auto)",
      invoiceDate: typeof body?.invoiceDate === "string" ? body.invoiceDate : null
    },
    parties: {
      billedTo: partySummary(body?.billedTo),
      billedBy: partySummary(body?.billedBy)
    },
    money: {
      currency: typeof body?.currency === "string" ? body.currency : null,
      subtotal: totals.subtotal
    },
    counts: {
      itemCount: totals.itemCount,
      totalQuantity: totals.totalQuantity,
      emailRecipients: countEmailRecipients(body?.email)
    },
    sideEffects: [
      "Creates an invoice in Refrens.",
      ...(countEmailRecipients(body?.email) > 0
        ? ["May send invoice email notifications to external recipients."]
        : [])
    ]
  };
}

function summarizeInvoiceCancel(pathValue, body) {
  const url = new URL(pathValue, "https://placeholder.invalid");
  return {
    resource: "invoice.cancel",
    identifiers: {
      invoiceId: url.pathname.split("/").at(-1),
      status: body?.status ?? null
    },
    flags: {
      cancelPayment: url.searchParams.get("cancelPayment") === "true"
    },
    sideEffects: [
      "Changes invoice status.",
      ...(url.searchParams.get("cancelPayment") === "true"
        ? ["Cancels associated payments as part of the same request."]
        : [])
    ]
  };
}

function summarizePaymentCreate(pathValue, body) {
  const url = new URL(pathValue, "https://placeholder.invalid");
  return {
    resource: "payment.create",
    identifiers: {
      invoiceId: url.pathname.split("/").at(-2),
      refId: typeof body?.refId === "string" ? body.refId : null,
      paymentMethod:
        typeof body?.paymentMethod === "string" ? body.paymentMethod : null
    },
    money: {
      amount: Number(body?.amount ?? 0),
      tds: Number(body?.tds ?? 0),
      transactionCharge: Number(body?.transactionCharge ?? 0)
    },
    sideEffects: ["Adds a payment record to an invoice."]
  };
}

function summarizeIrnCreate(pathValue) {
  const url = new URL(pathValue, "https://placeholder.invalid");
  return {
    resource: "invoice.irn.generate",
    identifiers: {
      invoiceId: url.pathname.split("/").at(-2)
    },
    flags: {
      includePaymentDetails:
        url.searchParams.get("includePaymentDetails") === "true"
    },
    sideEffects: ["Starts or updates an e-invoice / IRN workflow."]
  };
}

function summarizeExpenditureCreate(body) {
  const totals = getItemTotals(body?.items);
  return {
    resource: "expenditure.create",
    identifiers: {
      expenseNumber:
        typeof body?.expenseNumber === "string" ? body.expenseNumber : "(auto)"
    },
    parties: {
      billedBy: partySummary(body?.billedBy)
    },
    money: {
      currency: typeof body?.currency === "string" ? body.currency : null,
      subtotal: totals.subtotal
    },
    counts: {
      itemCount: totals.itemCount
    },
    sideEffects: ["Creates an expenditure record in Refrens."]
  };
}

function summarizeLeadCreate(body) {
  return {
    resource: "lead.create",
    identifiers: {
      externalId:
        typeof body?.externalId === "string" ? body.externalId : null,
      pipeline: typeof body?.pipeline === "string" ? body.pipeline : null,
      stage: typeof body?.stage === "string" ? body.stage : null
    },
    sideEffects: ["Creates a lead and may create linked client/contact records."]
  };
}

function summarizeLeadPatch(pathValue, body) {
  const pathname = getRoute(pathValue);
  return {
    resource: "lead.patch",
    identifiers: {
      leadId: pathname.split("/").at(-1),
      pipeline: typeof body?.pipeline === "string" ? body.pipeline : null,
      stage: typeof body?.stage === "string" ? body.stage : null,
      clientRequestId:
        typeof body?.clientRequestId === "string" ? body.clientRequestId : null
    },
    counts: {
      publicComments: Array.isArray(body?.publicComments)
        ? body.publicComments.length
        : 0,
      internalNotes: Array.isArray(body?.internalNotes)
        ? body.internalNotes.length
        : 0
    },
    sideEffects: ["Updates an existing lead, including stage or note changes."]
  };
}

function summarizeClientCreate(body) {
  return {
    resource: "client.create",
    identifiers: {
      clientId: typeof body?.clientId === "string" ? body.clientId : null,
      name: typeof body?.name === "string" ? body.name : null
    },
    sideEffects: ["Creates a client or vendor record in Refrens."]
  };
}

function summarizeBusinessCreate(body) {
  return {
    resource: "business.create",
    identifiers: {
      name: typeof body?.name === "string" ? body.name : null,
      country: typeof body?.country === "string" ? body.country : null
    },
    counts: {
      invitedUsers: Array.isArray(body?.auth?.email) ? body.auth.email.length : 0
    },
    sideEffects: ["Creates a child business and may invite users by email."]
  };
}

export function summarizeRequest(method, pathValue, body) {
  const route = getRoute(pathValue);

  if (method === "POST" && route === "/businesses") {
    return summarizeBusinessCreate(body);
  }
  if (method === "POST" && /\/businesses\/[^/]+\/invoices$/.test(route)) {
    return summarizeInvoiceCreate(body);
  }
  if (method === "PATCH" && /\/businesses\/[^/]+\/invoices\/[^/]+$/.test(route)) {
    return summarizeInvoiceCancel(pathValue, body);
  }
  if (
    method === "POST" &&
    /\/businesses\/[^/]+\/invoices\/[^/]+\/payments$/.test(route)
  ) {
    return summarizePaymentCreate(pathValue, body);
  }
  if (
    method === "POST" &&
    /\/businesses\/[^/]+\/invoices\/[^/]+\/irn$/.test(route)
  ) {
    return summarizeIrnCreate(pathValue);
  }
  if (method === "POST" && /\/businesses\/[^/]+\/expenditures$/.test(route)) {
    return summarizeExpenditureCreate(body);
  }
  if (method === "POST" && /\/api\/v1\/businesses\/[^/]+\/leads$/.test(route)) {
    return summarizeLeadCreate(body);
  }
  if (
    method === "PATCH" &&
    /\/api\/v1\/businesses\/[^/]+\/leads\/[^/]+$/.test(route)
  ) {
    return summarizeLeadPatch(pathValue, body);
  }
  if (
    method === "POST" &&
    /\/api\/v1\/businesses\/[^/]+\/clients$/.test(route)
  ) {
    return summarizeClientCreate(body);
  }

  return basicSummary(method, pathValue, body);
}

export function buildDryRunPreview({
  method,
  pathValue,
  body,
  summarySourceBody,
  confirmationHash
}) {
  return {
    dryRun: true,
    method,
    path: redactPath(pathValue),
    body,
    confirmationHash,
    summary: summarizeRequest(method, pathValue, summarySourceBody)
  };
}
