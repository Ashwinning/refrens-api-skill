# Endpoint matrix

Official source index: <https://www.refrens.com/api/docs/>

Default base URL in this CLI:

```text
https://api.refrens.com
```

Use literal `:urlKey` in CLI examples; the helper expands it from `.credentials` in memory.

| Method and documented path | Purpose | Risk / retry note |
| --- | --- | --- |
| `POST /authentication` | Create or validate a token | Transmits app credentials or a JWT; never log it |
| `POST /businesses` | Create a child business | Adds business records and may invite users; no documented retry guarantee |
| `POST /businesses/:urlKey/expenditures` | Record expenditure | Accounting mutation; no documented retry guarantee |
| `POST /businesses/:urlKey/invoices` | Create invoice | Financial mutation; may send email; no documented retry guarantee |
| `GET /businesses/:urlKey/invoices` | List invoices | Read-only |
| `GET /businesses/:urlKey/invoices/:invoiceId` | Get one invoice | Read-only |
| `PATCH /businesses/:urlKey/invoices/:invoiceId` | Cancel invoice | Financial state change; optional `cancelPayment=true` also cancels payments |
| `POST /businesses/:urlKey/invoices/:invoiceId/payments` | Add payment | Financial mutation; no documented retry guarantee |
| `GET /businesses/:urlKey/invoices/:invoiceId/payments` | List payments | Read-only |
| `POST /businesses/:urlKey/invoices/:invoiceId/irn` | Generate IRN | Regulatory/accounting mutation; no documented retry guarantee |
| `POST /api/v1/businesses/:urlKey/leads` | Create lead | Retry only with identical payload and the same `externalId` |
| `PATCH /api/v1/businesses/:urlKey/leads/:leadId` | Partially update lead | May change stage/assignee or append notes/comments |
| `GET /api/v1/businesses/:urlKey/leads` | List/search leads | Read-only |
| `POST /api/v1/businesses/:urlKey/clients` | Create client/vendor | Retry only with identical payload and the same `clientId` |
| `GET /api/v1/businesses/:urlKey/clients/:clientId` | Get one API-created client | Read-only |

`POST /authentication` is handled by the dedicated `auth` command. The generic `request` command intentionally covers the remaining allowlisted business-resource routes.

Open the corresponding official page before forming a live payload:

- Business: <https://www.refrens.com/api/docs/business/>
- Expenditures: <https://www.refrens.com/api/docs/expenditure/>
- Invoices: <https://www.refrens.com/api/docs/invoices/>
- Payment updates: <https://www.refrens.com/api/docs/payment-updates/>
- Generate IRN: <https://www.refrens.com/api/docs/generate-einvoice/>
- Leads: <https://www.refrens.com/api/docs/leads/>
- Clients: <https://www.refrens.com/api/docs/clients/>
