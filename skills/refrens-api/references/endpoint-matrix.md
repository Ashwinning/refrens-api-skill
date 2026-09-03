# Supported endpoint matrix

This is the bundled local supported-route index and allowlist for the skill.

Start here before any Refrens route work. If a method/path is not in this table, it is out of scope for this skill even if Refrens documents it elsewhere.

Default base URL in this CLI:

```text
https://api.refrens.com
```

Use literal `:urlKey` in CLI examples; the helper expands it from `.credentials` in memory.

| Method and allowlisted path | Local bundled reference | Purpose | Risk / retry note | Official fallback URL |
| --- | --- | --- | --- | --- |
| `POST /authentication` | [Route reference](route-reference.md#post-authentication) · [Bundled auth guide](authentication.md) | Create or validate a token | Transmits app credentials or a JWT; never log it | <https://www.refrens.com/api/docs/authentication/> |
| `POST /businesses` | [Route reference](route-reference.md#post-businesses) | Create a child business | Adds business records and may invite users; no documented retry guarantee | <https://www.refrens.com/api/docs/business/#create-new-business> |
| `POST /businesses/:urlKey/expenditures` | [Route reference](route-reference.md#post-expenditures) | Record expenditure | Accounting mutation; no documented retry guarantee | <https://www.refrens.com/api/docs/expenditure/#create-expenditure> |
| `POST /businesses/:urlKey/invoices` | [Route reference](route-reference.md#post-invoices) | Create invoice | Financial mutation; may send email; no documented retry guarantee | <https://www.refrens.com/api/docs/invoices/#create-new-invoice> |
| `GET /businesses/:urlKey/invoices` | [Route reference](route-reference.md#get-invoices) | List invoices | Read-only | <https://www.refrens.com/api/docs/invoices/#find-invoices> |
| `GET /businesses/:urlKey/invoices/:invoiceId` | [Route reference](route-reference.md#get-invoice) | Get one invoice | Read-only | <https://www.refrens.com/api/docs/invoices/#get-invoice> |
| `PATCH /businesses/:urlKey/invoices/:invoiceId` | [Route reference](route-reference.md#patch-invoice-cancel) | Cancel invoice | Financial state change; optional `cancelPayment=true` also cancels payments | <https://www.refrens.com/api/docs/invoices/#cancel-invoice> |
| `POST /businesses/:urlKey/invoices/:invoiceId/payments` | [Route reference](route-reference.md#post-payments) | Add payment | Financial mutation; no documented retry guarantee | <https://www.refrens.com/api/docs/payment-updates/#add-payment-to-invoice> |
| `GET /businesses/:urlKey/invoices/:invoiceId/payments` | [Route reference](route-reference.md#get-payments) | List payments | Read-only | <https://www.refrens.com/api/docs/payment-updates/#get-payments-on-invoice> |
| `POST /businesses/:urlKey/invoices/:invoiceId/irn` | [Route reference](route-reference.md#post-irn) | Generate IRN | Regulatory/accounting mutation; no documented retry guarantee | <https://www.refrens.com/api/docs/generate-einvoice/> |
| `POST /api/v1/businesses/:urlKey/leads` | [Route reference](route-reference.md#post-leads) | Create lead | Retry only with identical payload and the same `externalId` | <https://www.refrens.com/api/docs/leads/#create-new-lead> |
| `PATCH /api/v1/businesses/:urlKey/leads/:leadId` | [Route reference](route-reference.md#patch-lead) | Partially update lead | May change stage/assignee, relink snapshots, or append notes/comments | <https://www.refrens.com/api/docs/leads/#edit-existing-lead> |
| `GET /api/v1/businesses/:urlKey/leads` | [Route reference](route-reference.md#get-leads) | List/search leads | Read-only | <https://www.refrens.com/api/docs/leads/#list-and-search-leads> |
| `POST /api/v1/businesses/:urlKey/clients` | [Route reference](route-reference.md#post-clients) | Create client/vendor | Retry only with identical payload and the same `clientId` | <https://www.refrens.com/api/docs/clients/#create-new-client> |
| `GET /api/v1/businesses/:urlKey/clients/:clientId` | [Route reference](route-reference.md#get-client) | Get one API-created client | Read-only | <https://www.refrens.com/api/docs/clients/#get-a-client> |

`POST /authentication` is handled by the dedicated `auth` command. The generic `request` command intentionally covers the remaining allowlisted business-resource routes.

For supported routes, read the local route reference first. Only if the local bundle is insufficient, a field or response shape mismatches, or the live call errors should you open the official fallback URL in the last column. Whenever you do, cite the exact URL used.
