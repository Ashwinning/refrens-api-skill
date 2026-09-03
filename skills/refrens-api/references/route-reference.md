# Supported route reference

This is the bundled local route reference for the skill's current allowlist.

Read the relevant section here after `endpoint-matrix.md`. If the local bundle is sufficient, stay local. Only if a field is missing, a response shape mismatches, or the live API returns an error should you open the fallback official URL listed for that route. Whenever you do, cite that exact URL.

Use literal `:urlKey` placeholders in CLI examples. Mutation examples below use preview mode on purpose.

<a id="post-authentication"></a>
## POST /authentication

- **Purpose:** Create an app token with `strategy: "app-secret"` or validate an existing token with `strategy: "app-token"`.
- **CLI example:**

  ```powershell
  npx refrens-api-skill auth --approve-origin https://api.refrens.com --validate
  ```

- **Key fields known locally:**
  - `strategy: "app-secret"` requires `appId` and `appSecret`
  - `strategy: "app-token"` requires a bearer token in `Authorization`
- **Important side effects:** Issues or validates a JWT. Never print or persist the plaintext token unless the operator explicitly opts into the DPAPI cache.
- **Retry / idempotency notes:** Safe to request a fresh token, but do not keep replaying altered credentials blindly. If auth behavior differs from this bundle, verify against the fallback page before proceeding.
- **Fallback official URL:** <https://www.refrens.com/api/docs/authentication/>

<a id="post-businesses"></a>
## POST /businesses

- **Purpose:** Create a child business under the authenticated parent business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST /businesses --body-file .\business.json --dry-run
  ```

- **Key fields known locally:**
  - required: `name`, `country`, `auth.email`
  - useful optional fields: `gstin`, `billedTo.*`
- **Important side effects:** Creates a new business record, returns a new `urlKey`, and may invite users listed in `auth.email`.
- **Retry / idempotency notes:** No documented retry guarantee. If the result is uncertain, inspect the returned business or dashboard state before trying again.
- **Fallback official URL:** <https://www.refrens.com/api/docs/business/#create-new-business>

<a id="post-expenditures"></a>
## POST /businesses/:urlKey/expenditures

- **Purpose:** Record an expenditure for a business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST /businesses/:urlKey/expenditures --body-file .\expenditure.json --dry-run
  ```

- **Key fields known locally:**
  - required: `billedBy.name`, `billedBy.country`, `items`
  - each item requires `name`, `rate`, and `quantity`
  - commonly used optional fields: `expenseNumber`, `invoiceNumber`, `invoiceDate`, `invoiceType`, `currency`
- **Important side effects:** Creates an accounting record. If email details are included, review them carefully before going live.
- **Retry / idempotency notes:** No documented retry guarantee. `expenseNumber` should be unique if supplied; if omitted, Refrens may auto-increment from the last expenditure number.
- **Fallback official URL:** <https://www.refrens.com/api/docs/expenditure/#create-expenditure>

<a id="post-invoices"></a>
## POST /businesses/:urlKey/invoices

- **Purpose:** Create an invoice for a business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST /businesses/:urlKey/invoices --body-file .\invoice.json --dry-run
  ```

- **Key fields known locally:**
  - required: `billedTo.name`, `billedTo.country`, `items`
  - each item requires `name`, `rate`, and `quantity`
  - commonly used optional fields: `invoiceNumber`, `invoiceDate`, `dueDate`, `invoiceType`, `currency`, `email`
- **Important side effects:** Creates a financial document. An `email` block may notify third parties immediately after creation.
- **Retry / idempotency notes:** No documented retry guarantee. `invoiceNumber` should be unique if supplied; if omitted, Refrens may auto-increment it.
- **Fallback official URL:** <https://www.refrens.com/api/docs/invoices/#create-new-invoice>

<a id="get-invoices"></a>
## GET /businesses/:urlKey/invoices

- **Purpose:** List invoices for a business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request GET '/businesses/:urlKey/invoices?$limit=5' --approve-origin https://api.refrens.com
  ```

- **Key query params known locally:**
  - `$limit`
  - `$skip`
  - `$sort[createdAt]`
  - `$sort[invoiceNumber]`
  - `$sort[invoiceDate]`
- **Important side effects:** Read-only.
- **Retry / idempotency notes:** Conservative retries are acceptable.
- **Fallback official URL:** <https://www.refrens.com/api/docs/invoices/#find-invoices>

<a id="get-invoice"></a>
## GET /businesses/:urlKey/invoices/:invoiceId

- **Purpose:** Fetch one invoice by `_id`.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request GET /businesses/:urlKey/invoices/:invoiceId --approve-origin https://api.refrens.com
  ```

- **Key fields known locally:**
  - required path values: `urlKey`, `invoiceId`
- **Important side effects:** Read-only.
- **Retry / idempotency notes:** Conservative retries are acceptable.
- **Fallback official URL:** <https://www.refrens.com/api/docs/invoices/#get-invoice>

<a id="patch-invoice-cancel"></a>
## PATCH /businesses/:urlKey/invoices/:invoiceId

- **Purpose:** Cancel an existing invoice.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request PATCH '/businesses/:urlKey/invoices/:invoiceId?cancelPayment=true' --body-file .\cancel-invoice.json --dry-run
  ```

- **Key fields known locally:**
  - required path values: `urlKey`, `invoiceId`
  - mutation body used by this skill: `{"status":"CANCELED"}`
  - optional query param: `cancelPayment=true`
- **Important side effects:** Changes invoice state to canceled. With `cancelPayment=true`, associated payments are also canceled.
- **Retry / idempotency notes:** Do not assume retry safety. Re-check current invoice state before repeating a cancellation attempt.
- **Fallback official URL:** <https://www.refrens.com/api/docs/invoices/#cancel-invoice>

<a id="post-payments"></a>
## POST /businesses/:urlKey/invoices/:invoiceId/payments

- **Purpose:** Add a payment to an invoice.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST /businesses/:urlKey/invoices/:invoiceId/payments --body-file .\payment.json --dry-run
  ```

- **Key fields known locally:**
  - known body fields: `amount`, `paymentDate`, `paymentMethod`, `tds`, `transactionCharge`, `notes`, `refId`
  - documented payment methods: `ACCOUNT_TRANSFER`, `CASH`, `CHEQUE`, `CREDIT_CARD`, `DEBIT_CARD`, `DD`, `UPI`
- **Important side effects:** Creates a payment record against the invoice balance.
- **Retry / idempotency notes:** No documented retry guarantee. `refId` is useful for reconciliation but is not documented as an idempotency key.
- **Fallback official URL:** <https://www.refrens.com/api/docs/payment-updates/#add-payment-to-invoice>

<a id="get-payments"></a>
## GET /businesses/:urlKey/invoices/:invoiceId/payments

- **Purpose:** List payments recorded against one invoice.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request GET /businesses/:urlKey/invoices/:invoiceId/payments --approve-origin https://api.refrens.com
  ```

- **Key fields known locally:**
  - required path values: `urlKey`, `invoiceId`
- **Important side effects:** Read-only.
- **Retry / idempotency notes:** Conservative retries are acceptable.
- **Fallback official URL:** <https://www.refrens.com/api/docs/payment-updates/#get-payments-on-invoice>

<a id="post-irn"></a>
## POST /businesses/:urlKey/invoices/:invoiceId/irn

- **Purpose:** Generate an IRN for an existing invoice.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST '/businesses/:urlKey/invoices/:invoiceId/irn?includePaymentDetails=true' --body-file .\empty.json --dry-run
  ```

- **Key fields known locally:**
  - required path values: `urlKey`, `invoiceId`
  - optional query param: `includePaymentDetails=true`
- **Important side effects:** Triggers e-invoice / IRN generation for the target invoice and may include payment details in the generated record.
- **Retry / idempotency notes:** No documented retry guarantee. If generation status is unclear, inspect the invoice state before trying again.
- **Fallback official URL:** <https://www.refrens.com/api/docs/generate-einvoice/>

<a id="post-leads"></a>
## POST /api/v1/businesses/:urlKey/leads

- **Purpose:** Create a CRM lead in a business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST /api/v1/businesses/:urlKey/leads --body-file .\lead.json --dry-run
  ```

- **Key fields known locally:**
  - required: `externalId`, `customer`, `contact`, `pipeline`, `stage`
  - `customer` accepts `clientId` or `name`
  - `contact` accepts `contactId` or `name`
  - `leadSource`, `pipeline`, `stage`, and `tags` resolve by existing names and are never auto-created
- **Important side effects:** Creates a lead and may create a new client/contact snapshot when only names are supplied.
- **Retry / idempotency notes:** Safe retry only with the same `externalId` and an identical payload. Same `externalId` plus different details returns `409 IDEMPOTENCY_CONFLICT`.
- **Fallback official URL:** <https://www.refrens.com/api/docs/leads/#create-new-lead>

<a id="patch-lead"></a>
## PATCH /api/v1/businesses/:urlKey/leads/:leadId

- **Purpose:** Partially update an existing lead.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request PATCH /api/v1/businesses/:urlKey/leads/:leadId --body-file .\lead-patch.json --dry-run
  ```

- **Key fields known locally:**
  - common patch fields: `subject`, `details`, `budget`, `followUpDate`, `leadSource`, `assignedTo`, `pipeline`, `stage`, `stageReasons`
  - tag update modes: `tags` or `tagsAdd` / `tagsRemove`
  - activity appenders: `addComments`, `addInternalNotes`
  - snapshot relinking fields: `customer`, `contact`
  - `externalId` is create-only and cannot be patched
- **Important side effects:** Can change ownership, stage, tags, follow-up state, customer/contact snapshots, and append public comments or internal notes.
- **Retry / idempotency notes:** PATCH itself has no general retry guarantee. For appended comments/notes, only identical batches with the same `clientRequestId` are documented as retry-safe.
- **Fallback official URL:** <https://www.refrens.com/api/docs/leads/#edit-existing-lead>

<a id="get-leads"></a>
## GET /api/v1/businesses/:urlKey/leads

- **Purpose:** List or search leads in a business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request GET '/api/v1/businesses/:urlKey/leads?$limit=10&q=acme' --approve-origin https://api.refrens.com
  ```

- **Key query params known locally:**
  - paging: `$limit`, `$skip`, `$sort`
  - structured filters: `pipeline`, `stage`, `tags`, `leadSource`, `assignedTo`, `status`
  - exact-match lookups: `externalId`, `clientId`, `contactId`, `contactName`, `contactEmail`, `contactPhone`
  - ranges and text search: `createdAt`, `followUpDate`, `budget`, `q`, `subject`, `details`
- **Important side effects:** Read-only.
- **Retry / idempotency notes:** Conservative retries are acceptable.
- **Fallback official URL:** <https://www.refrens.com/api/docs/leads/#list-and-search-leads>

<a id="post-clients"></a>
## POST /api/v1/businesses/:urlKey/clients

- **Purpose:** Create a client or vendor record for a business.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request POST /api/v1/businesses/:urlKey/clients --body-file .\client.json --dry-run
  ```

- **Key fields known locally:**
  - required: `clientId`, `name`
  - commonly used optional fields: `email`, `phone`, `country`, `gstin`, `dueInDays`, `shippingDetails`, `bankAccounts`, `customFields`
  - derived when omitted: `panNumber`, `gstState`, `taxPayerType`, `clientType`, `locale`
- **Important side effects:** Creates a customer/vendor record and may normalize or derive tax and locale fields on the stored result.
- **Retry / idempotency notes:** Safe retry only with the same `clientId` and an identical payload. Same `clientId` plus different details returns `409 IDEMPOTENCY_CONFLICT`.
- **Fallback official URL:** <https://www.refrens.com/api/docs/clients/#create-new-client>

<a id="get-client"></a>
## GET /api/v1/businesses/:urlKey/clients/:clientId

- **Purpose:** Fetch one API-created client by caller-owned `clientId`.
- **CLI example:**

  ```powershell
  npx refrens-api-skill request GET /api/v1/businesses/:urlKey/clients/:clientId --approve-origin https://api.refrens.com
  ```

- **Key fields known locally:**
  - required path values: `urlKey`, `clientId`
  - this helper only supports create and get-one for clients
- **Important side effects:** Read-only.
- **Retry / idempotency notes:** Conservative retries are acceptable.
- **Fallback official URL:** <https://www.refrens.com/api/docs/clients/#get-a-client>
