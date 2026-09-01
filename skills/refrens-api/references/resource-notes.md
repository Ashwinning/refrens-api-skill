# Resource notes

These are routing and safety notes, not a substitute for re-reading the official Refrens docs before a live call.

## Invoices, expenditures, payments, and IRN

- Invoice create requires `billedTo.name`, `billedTo.country`, and `items`; each item requires `name`, `rate`, and `quantity`.
- `invoiceNumber` should be unique if supplied. If omitted, the server may auto-increment depending on current Refrens behavior.
- An `email` block may notify third parties, so dry-run it carefully before going live.
- Expenditure create similarly requires vendor `billedBy.name`, `billedBy.country`, and line items.
- Invoice cancellation uses `{"status":"CANCELED"}`. The documented `cancelPayment=true` query also cancels associated payments.
- Payment create documents amount, TDS, transaction charge, date, method, notes, and `refId`.
- IRN generation targets an existing invoice and optionally accepts `includePaymentDetails=true`.

## Leads

- Lead create requires `externalId`, customer details, contact details, `pipeline`, and `stage`.
- Same `externalId` plus identical details is the only safe retry shape documented by Refrens.
- Lead PATCH is partial and cannot change `externalId`.
- Public comments and internal notes can use `clientRequestId` for retry-safe identical batches.
- Lead list/search is read-only and supports paging plus documented filters.

## Clients

- Client create requires caller-owned `clientId` and `name`.
- Refrens treats `clientId` as identity for the documented API create/get flow.
- Equivalent retries are only safe when the `clientId` and full payload stay unchanged.
- No list, update, or delete client operation is currently documented for this helper.

## Invoice batch workflow in this repository

The batch helper is intentionally generic:

- input comes from a JSON file
- shared fields go under `defaults`
- shared item fields go under `defaults.itemDefaults`
- optional `referenceInvoice` fields can fill missing invoice/item defaults
- invoice-specific fields override both

This keeps the workflow reusable for open-source distribution while preserving the safe preview/create pattern.
