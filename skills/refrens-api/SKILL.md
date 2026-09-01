---
name: refrens-api
description: Safely authenticate and work with the Refrens REST API for businesses, invoices, expenditures, payments, IRNs, leads, and clients. Use for Refrens API planning, reads, dry-runs, and reviewed mutations.
license: MIT
compatibility: Requires Node.js 18.18+ and network access to https://api.refrens.com
---

# Refrens API

Use the official Refrens docs at <https://www.refrens.com/api/docs/> as the source of truth. Re-check the relevant official page before relying on fields or response shapes that may have changed.

## Before every live operation

1. If `.credentials` is missing, first read `references/getting-credentials.md` and either:
   - ask the user for `app_id`, `app_secret`, and `url_key`, or
   - tell them to run `npx refrens-api-skill setup`
2. Read `references/authentication.md`.
3. Read `references/endpoint-matrix.md`.
4. Read `references/resource-notes.md` for the resource you plan to use.
5. Read `references/safety-and-validation.md` before any `POST` or `PATCH`.
6. Use `scripts/refrens-api.js` or the published npm package rather than inventing raw requests.

## Included tooling

From the skill directory:

```powershell
node .\scripts\refrens-api.js --help
```

From npm after publication:

```powershell
npx refrens-api-skill --help
```

From a public skills install:

```powershell
npx skills add Ashwinning/refrens-api-skill --skill refrens-api -a github-copilot
```

## Safe workflow

- credentials are read from `.credentials` unless an explicit path is supplied
- default base URL is `https://api.refrens.com`
- literal `:urlKey` placeholders are expanded from the credential file in memory
- supported routes are limited to the documented allowlist in `references/endpoint-matrix.md`
- dry-runs print a redacted preview and a request-bound `confirmationHash`
- live `POST` and `PATCH` require the exact hash from the approved dry-run
- live auth and live requests require `--approve-origin` for the exact HTTPS origin
- tokens are kept in memory unless the user explicitly opts into the Windows DPAPI cache

## Primary commands

### Validate local setup

```powershell
node .\scripts\refrens-api.js check
```

### First-time setup

```powershell
node .\scripts\refrens-api.js setup
```

### Authenticate

```powershell
node .\scripts\refrens-api.js auth --approve-origin https://api.refrens.com
```

### Read invoices

```powershell
node .\scripts\refrens-api.js request GET '/businesses/:urlKey/invoices?$limit=5' --approve-origin https://api.refrens.com
```

### Preview an invoice creation

```powershell
node .\scripts\refrens-api.js request POST /businesses/:urlKey/invoices --body-file .\invoice.json --dry-run
```

### Preview a batch

```powershell
node .\scripts\refrens-api.js invoice-batch preview --input .\invoice-batch.json
```

## Batch invoices

Use `assets/invoice-batch.example.json` for an offline-friendly template, or `assets/invoice-batch.reference.example.json` when you want to copy defaults from an existing invoice. Do not add personal data, local absolute paths, or user-specific invoice entries to the repository.

## Notes

- preserve Refrens path prefixes exactly as documented
- never print credentials, tokens, or authorization headers
- do not assume undocumented retry guarantees
- stop when an endpoint or field is undocumented instead of guessing
