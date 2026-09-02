# Refrens API Skill

(Not officially affiliated with Refrens)

Use your Refrens account from popular coding agents such as **ChatGPT (work mode / Codex)**, **Claude Code**, **GitHub Copilot**, **Cursor**, and other agentic developer tools that can use installed skills or run a CLI. This project gives those agents a safe, reviewable way to turn messy business input—handwritten invoice photos, receipt images, payment confirmations, CRM notes, spreadsheet rows, or internal finance instructions—into structured Refrens actions through the Refrens API.

Why use this: if your team already works inside AI coding agents, this skill lets those agents help operate your Refrens account instead of stopping at drafts. They can guide setup, structure data, preview mutations safely, and then create invoices, expenditures, payments, leads, clients, and IRN requests with explicit review points.

## Quick start

Install the skill:

```powershell
npx skills add Ashwinning/refrens-api-skill
```

Add `-a github-copilot`, `-a claude-code`, or another supported host when you want to target one specific agent directly. Because this repository currently contains one skill, `--skill refrens-api` is optional.

Then set up credentials:

```powershell
npx refrens-api-skill setup
```

## Example workflows

These are the kinds of high-value AI-assisted workflows this repo is designed for, based on the documented Refrens API surfaces for invoices, expenditures, payments, leads, clients, and IRN generation.

### Turn messy paperwork into revenue-ready records

- **Convert handwritten invoice photos, scanned PDFs, or rough work notes into digital invoices** — An agent can extract dates, line items, taxes, client details, and billing context, then prepare a clean Refrens invoice for review.
- **Turn vendor bills, receipt images, and expense proofs into structured expenditure entries** — An agent can pull totals, tax values, vendor names, and dates from unstructured documents and record them as Refrens expenditures.

### Put recurring billing and finance ops on autopilot

- **Generate repeat invoices from retainers, monthly service plans, or spreadsheet exports** — An agent can prepare invoice batches for recurring work, preview everything safely, and keep repeated billing consistent month after month.
- **Reuse known invoice defaults instead of rebuilding them every cycle** — An agent can copy stable fields such as `billedTo`, currency, invoice type, tax rates, or line-item defaults from prior invoices and apply them to new ones.

### Close the loop from payment signal to books updated

- **Sync UTRs, bank confirmation emails, payment screenshots, and finance chat messages to the correct invoice** — An agent can interpret incoming payment evidence and add payment updates to the matching Refrens invoice.
- **Reconcile collections faster by reviewing invoice and payment history together** — An agent can look up invoices, inspect payment records, and help operators decide what is still unpaid, partially paid, or ready to be marked off.

### Feed your sales pipeline without copy-paste CRM work

- **Turn website forms, WhatsApp chats, call summaries, and meeting notes into Refrens CRM leads** — An agent can convert unstructured sales input into properly staged leads with customer/contact details, pipeline, stage, source, tags, budget, and assignee data.
- **Normalize client records before billing or lead sync** — An agent can create or fetch API-managed clients by `clientId` so downstream invoice or CRM workflows start from clean, reusable customer records.

### Stay GST-ready without last-minute compliance scrambles

- **Validate invoice data before you trigger IRN generation** — An agent can help review required billing and tax fields, catch obvious gaps, and prepare a safer IRN request flow for Indian e-invoicing.
- **Generate IRNs for invoices that are already ready in Refrens** — Once the invoice exists and the tax details are correct, an agent can help initiate Refrens IRN generation and optionally include payment details when needed.

Refrens also markets broader product capabilities like quotations, inventory, and payment reminders. This repo intentionally focuses on the documented API-backed overlap that is currently safest for agent automation: invoices, expenditures, payments, leads, clients, and IRN generation.

## What ships in this repo

- a publishable npm package you can run with `npx`, and
- an installable GitHub skill at `skills/refrens-api`.

It is designed for **safe, reviewable Refrens API usage**: authenticated requests, dry-run confirmation hashes for mutations, `:urlKey` placeholder expansion, response redaction, and a generic invoice batch workflow driven by JSON input.

### Repository layout

- `bin/refrens-api.js` - npm CLI entrypoint
- `skills/refrens-api/SKILL.md` - installable skill definition
- `skills/refrens-api/scripts/` - self-contained CLI implementation used by the skill
- `skills/refrens-api/references/` - Refrens API notes, safety rules, and endpoint matrix
- `skills/refrens-api/references/getting-credentials.md` - simple end-user guide for locating Refrens credentials
- `skills/refrens-api/assets/invoice-batch.example.json` - offline-friendly batch input example
- `skills/refrens-api/assets/invoice-batch.reference.example.json` - example using reference-invoice defaults
- `tests/` - unit tests for credential parsing, request safety, and invoice batch planning
- `.github/workflows/ci.yml` - minimal CI

## Features

- App-secret authentication against `POST /authentication`
- Default base URL of `https://api.refrens.com`
- Interactive `setup` command for creating `.credentials`
- Exact documented path preservation, including `/businesses/...` and `/api/v1/businesses/...`
- Endpoint allowlist for supported routes
- `.credentials` parsing without sourcing or executing shell content
- Redaction of secrets, tokens, emails, phones, tax IDs, and other sensitive fields
- Dry-run previews with request-bound SHA-256 confirmation hashes
- Safe live mutation flow for `POST` and `PATCH`
- Optional Windows-only encrypted DPAPI token cache
- Generic invoice batch preview/create workflow

## Requirements

- Node.js 18.18+ (tested with modern Node)
- Refrens API access enabled on your Refrens business
- Refrens API credentials
- A working `.credentials` file in your current directory, or use `setup` / `--credentials <path>` to create one

## Refrens setup and authentication

### 1) Enable API access on your Refrens account

Refrens documents API access as an account-level capability. Their docs say you need API access enabled for your business, and premium users may need to contact Refrens support to turn it on.

- Official docs: <https://www.refrens.com/api/docs/>
- Product page: <https://www.refrens.com/api>
- Support: `care@refrens.com`

### 2) Generate the credentials your agent needs

From the Refrens dashboard, generate API keys from the business integration settings. Refrens' help content describes the flow as:

`Business Settings -> Integrations -> Accounting Integrations -> Generate API Keys`

Collect these values:

| Refrens value | Local key in `.credentials` | Required | Used for |
| --- | --- | --- | --- |
| App ID | `app_id` | Yes | App-secret authentication |
| App Secret | `app_secret` | Yes | App-secret authentication |
| Business URL Key | `url_key` | Usually | Expands `:urlKey` in documented routes |
| ECDSA P-256 private key | `private_key` | Optional | Self-signed JWT workflows outside this helper |
| API base URL | `base_url` | Optional | Defaults to `https://api.refrens.com` |

### 3) Understand the supported auth flow

This repository uses the simpler documented **app-secret** flow by default:

```http
POST https://api.refrens.com/authentication
Content-Type: application/json
```

```json
{
  "strategy": "app-secret",
  "appId": "<app_id>",
  "appSecret": "<app_secret>"
}
```

Protected Refrens requests then send the returned JWT as an `Authorization` header. This CLI never prints that token, and live auth/request commands require an explicit `--approve-origin` value for the host you are about to use.

Refrens also documents a self-signed ES256 JWT flow using the private key they provide. That flow is described in the included reference docs, but this package intentionally stays with app-secret auth to keep the runtime lightweight and predictable.

### 4) Create `.credentials` interactively

If you do not have a credentials file yet, run:

```powershell
npx refrens-api-skill setup
```

The setup flow asks for:

1. App ID
2. App Secret
3. Business URL Key
4. Base URL (defaults to `https://api.refrens.com`)

If you need help finding those values, use the simple guide here:

- local file: `skills/refrens-api/references/getting-credentials.md`
- GitHub link: <https://github.com/Ashwinning/refrens-api-skill/blob/main/skills/refrens-api/references/getting-credentials.md>

When you run `check`, `auth`, `request`, or `invoice-batch` in an interactive terminal and `.credentials` is missing, the CLI starts the same setup flow automatically.

## Install options

Example installs for common agent hosts:

```powershell
npx skills add Ashwinning/refrens-api-skill -a github-copilot
npx skills add Ashwinning/refrens-api-skill -a claude-code
npx skills add Ashwinning/refrens-api-skill -g -a github-copilot
```

Other supported install shapes depend on the local skills CLI version, but current skills tooling commonly supports:

- `owner/repo`
- GitHub repository URLs
- direct GitHub tree URLs
- local paths

If you want the explicit equivalent, this also works:

```powershell
npx skills add Ashwinning/refrens-api-skill --skill refrens-api -a github-copilot
```

In this repository, the installable skill lives at `skills/refrens-api/SKILL.md`.

## Run the CLI directly

From npm:

```powershell
npx refrens-api-skill --help
```

From a checkout of this repository:

```powershell
node .\bin\refrens-api.js --help
```

If you install the package globally, the bin command is:

```powershell
refrens-api --help
```

## Credentials file format

Copy `.credentials.example` to `.credentials` and replace the placeholders:

```ini
app_id="your-app-id"
app_secret="your-app-secret"
url_key="your-business-url-key"
base_url="https://api.refrens.com"
```

Notes:

- `app_id` and `app_secret` are required for authentication.
- `url_key` is required whenever you use a CLI path containing `:urlKey`.
- `base_url` is optional because the CLI defaults to `https://api.refrens.com`.
- Multiline quoted `private_key` values are parsed, but this repository currently authenticates with the simpler `app-secret` flow.
- The CLI parses this file as data only. It never sources or executes it.

Recommended first run:

```powershell
npx refrens-api-skill setup
node .\bin\refrens-api.js check --credentials .\.credentials
node .\bin\refrens-api.js auth --credentials .\.credentials --approve-origin https://api.refrens.com --validate
```

## Where credentials are stored

The CLI keeps credential storage intentionally simple:

| File | Default location | When it is created | What it contains |
| --- | --- | --- | --- |
| `.credentials` | Your current working directory | `setup`, first-run setup fallback, or manual creation | `app_id`, `app_secret`, `url_key`, and optional `base_url` |
| `.refrens-token.dpapi` | Next to the selected credentials file | Only when you use `--persist-token` | Windows-user-encrypted JWT cache |

Important details:

- `setup` writes `.credentials` to the directory where you run the command, unless you override it with `--credentials C:\path\to\.credentials`.
- the package does **not** store secrets inside the npm package, inside the installed skill folder, or inside the GitHub repository
- the optional token cache is created only when you explicitly opt in with `--persist-token`
- both files are meant to stay local and ignored by git

### What happens with `npx`

When someone runs:

```powershell
npx refrens-api-skill setup
```

`npx` downloads the package to npm's cache if it is not already available, then runs the published `refrens-api` bin from that cached package. The important part is that the CLI still treats **your current working directory** as the place where `.credentials` should live.

That means:

- the executable code can come from npm cache
- the persisted `.credentials` file is written to the caller's current directory
- `--credentials <path>` moves that storage location wherever the caller wants
- if `--persist-token` is used later, `.refrens-token.dpapi` is written next to that chosen credentials file

### What happens with `npx skills add`

Installing the skill is a separate step from storing credentials.

When someone runs:

```powershell
npx skills add Ashwinning/refrens-api-skill -a github-copilot
```

the skill files are copied or symlinked into the agent's skill directory, but credentials are still written only when the operator runs the setup flow. By default that means `.credentials` is created in the project directory where the operator is working, not inside `.agents/skills/refrens-api`.

### Base URL precedence

1. `--base-url`
2. `REFRENS_API_BASE_URL`
3. `base_url` from `.credentials`
4. built-in default `https://api.refrens.com`

## Environment variables

- `REFRENS_API_BASE_URL` - overrides the default base URL

## Safety model

### Live origin approval

Live authentication and live API calls require:

```powershell
--approve-origin https://api.refrens.com
```

If you override the base URL, approve that exact HTTPS origin instead.

### Dry-run before mutation

`POST` and `PATCH` requests are intentionally two-step:

1. run a dry-run preview
2. review the sanitized output and `confirmationHash`
3. rerun the exact same request with `--confirm-hash <hash>`

Any change to method, path, base URL, or request body changes the hash.

## Command reference

### 1) `setup`

Create or replace `.credentials` interactively:

```powershell
npx refrens-api-skill setup
```

Pick a custom location:

```powershell
npx refrens-api-skill setup --credentials C:\path\to\.credentials
```

Replace an existing file intentionally:

```powershell
npx refrens-api-skill setup --overwrite
```

### 2) `check`

Validate the credential file, Windows ACL safety checks, and resolved base URL without a network call:

```powershell
npx refrens-api-skill check
```

Example output:

```json
{
  "credentialsFile": "C:\\path\\to\\.credentials",
  "credentialPermissionsSafe": true,
  "requiredNamesPresent": true,
  "urlKeyPresent": true,
  "privateKeyPresent": false,
  "baseUrl": "https://api.refrens.com",
  "baseUrlSource": "default",
  "baseUrlValid": true
}
```

### 3) `auth`

Authenticate without printing the bearer token:

```powershell
npx refrens-api-skill auth --approve-origin https://api.refrens.com
```

Validate the returned token in the same run:

```powershell
npx refrens-api-skill auth --approve-origin https://api.refrens.com --validate
```

Persist the token in the Windows DPAPI cache:

```powershell
npx refrens-api-skill auth --approve-origin https://api.refrens.com --persist-token
```

Token persistence notes:

- cache file default: `.refrens-token.dpapi`
- default location: next to the selected credentials file
- supported only on Windows

### 4) `request`

Generic request flow for supported `GET`, `POST`, and `PATCH` endpoints.

#### Read-only example

```powershell
npx refrens-api-skill request GET '/businesses/:urlKey/invoices?$limit=5' --approve-origin https://api.refrens.com
```

#### Mutation dry-run example

```powershell
npx refrens-api-skill request POST /businesses/:urlKey/invoices --body-file .\invoice.json --dry-run
```

The output includes:

- redacted path
- redacted body
- request summary
- `confirmationHash`

#### Mutation live example

```powershell
npx refrens-api-skill request POST /businesses/:urlKey/invoices `
  --body-file .\invoice.json `
  --confirm-hash <hash-from-dry-run> `
  --approve-origin https://api.refrens.com
```

#### Cached token example

```powershell
npx refrens-api-skill request GET '/businesses/:urlKey/invoices?$limit=5' `
  --use-cached-token `
  --approve-origin https://api.refrens.com
```

If a cached-token `GET` returns `401`, the CLI performs one fresh-auth retry.

### 5) `invoice-batch`

Generic invoice creation workflow driven by a JSON input file.

#### Preview a batch

```powershell
npx refrens-api-skill invoice-batch preview --input .\invoice-batch.json
```

#### Preview using defaults from an existing invoice

```powershell
npx refrens-api-skill invoice-batch preview `
  --input .\invoice-batch.json `
  --reference-invoice-id <existing-invoice-id> `
  --approve-origin https://api.refrens.com
```

#### Create the batch

Repeat `--confirm-hash` for every invoice key printed by preview:

```powershell
npx refrens-api-skill invoice-batch create `
  --input .\invoice-batch.json `
  --confirm-hash aug-2026=<hash-1> `
  --confirm-hash sept-2026=<hash-2> `
  --approve-origin https://api.refrens.com
```

Creation stops on the first failed invoice and prints any partial results.

## Invoice batch JSON format

See these ready-made templates:

- `skills/refrens-api/assets/invoice-batch.example.json`
- `skills/refrens-api/assets/invoice-batch.reference.example.json`

Top-level shape:

```json
{
  "defaults": {
    "path": "/businesses/:urlKey/invoices",
    "currency": "INR",
    "invoiceType": "INVOICE",
    "billedTo": {
      "name": "Example Client Pvt Ltd",
      "country": "IN"
    },
    "itemDefaults": {
      "name": "Professional Services",
      "rate": 25000,
      "gstRate": 18
    }
  },
  "referenceInvoice": {
    "invoiceId": "optional-existing-invoice-id",
    "copyInvoiceFields": ["currency", "invoiceType", "billedBy", "billedTo"],
    "copyItemFields": ["name", "rate", "gstRate"],
    "referenceItemIndex": 0
  },
  "invoices": [
    {
      "key": "aug-2026",
      "invoiceNumber": "INV-2026-08",
      "invoiceDate": "2026-08-31",
      "items": [
        {
          "description": "Implementation sprint",
          "quantity": 3
        },
        {
          "description": "Launch support",
          "quantity": 1,
          "rate": 28000
        }
      ]
    }
  ]
}
```

Rules:

- `invoices` must be a non-empty array.
- Each final invoice must contain `invoiceDate`, `billedTo.name`, `billedTo.country`, and at least one item.
- Each final item must contain `name`, `quantity > 0`, and `rate >= 0`.
- `defaults.itemDefaults` fills missing fields in each invoice item.
- `referenceInvoice` is optional.
- If `referenceInvoice` is present, the first reference item is used by default unless `referenceItemIndex` is set.
- Invoice objects may include additional Refrens invoice fields; they are passed through unchanged.

## Supported endpoints

The CLI currently allows the same documented routes covered by the included skill references:

| Method | Path |
| --- | --- |
| GET | `/businesses/:urlKey/invoices` |
| GET | `/businesses/:urlKey/invoices/:invoiceId` |
| GET | `/businesses/:urlKey/invoices/:invoiceId/payments` |
| GET | `/api/v1/businesses/:urlKey/leads` |
| GET | `/api/v1/businesses/:urlKey/clients/:clientId` |
| POST | `/businesses` |
| POST | `/businesses/:urlKey/expenditures` |
| POST | `/businesses/:urlKey/invoices` |
| POST | `/businesses/:urlKey/invoices/:invoiceId/irn` |
| POST | `/businesses/:urlKey/invoices/:invoiceId/payments` |
| POST | `/api/v1/businesses/:urlKey/leads` |
| POST | `/api/v1/businesses/:urlKey/clients` |
| PATCH | `/businesses/:urlKey/invoices/:invoiceId` |
| PATCH | `/api/v1/businesses/:urlKey/leads/:leadId` |

Notes:

- `POST /authentication` is handled by the dedicated `auth` command.
- the generic `request` command covers the remaining allowlisted business-resource routes

See the reference files under `skills/refrens-api/references/` for risk notes and field guidance.

## Troubleshooting

### `Credentials file not found`

- create `.credentials` in your working directory, or
- pass `--credentials C:\full\path\to\.credentials`

### `Credential file permissions are unsafe`

On Windows, the CLI checks for broad Modify/Write/Full permissions on the credentials file. Fix the ACLs, or use:

```powershell
--allow-unsafe-credential-permissions
```

for a single explicitly approved run.

### `Credential url_key is required for a :urlKey path`

Add `url_key` to `.credentials`, or replace `:urlKey` in your path with a literal URL-safe business key before running the command.

### `Method/path is not in the documented endpoint allowlist`

The CLI intentionally rejects undocumented or currently unsupported routes. Recheck the Refrens docs and the local endpoint matrix.

### `Live authentication and requests require --approve-origin ...`

This is expected for live auth, live requests, and reference-invoice lookups. Add the exact origin shown in the error.

### Windows token cache errors

- token persistence is Windows-only
- PowerShell must be available
- the cache file must be readable by the same Windows user who created it

## Skill-first usage

If you install the skill, start with:

- `skills/refrens-api/SKILL.md`
- `skills/refrens-api/references/authentication.md`
- `skills/refrens-api/references/endpoint-matrix.md`
- `skills/refrens-api/references/safety-and-validation.md`

The skill scripts mirror the npm CLI, so both distribution channels stay aligned.

## Development

Run tests:

```powershell
npm test
```

Check the npm package contents:

```powershell
npm run pack:check
```

See `CONTRIBUTING.md` for contribution expectations.
