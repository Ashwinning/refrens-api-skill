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
6. Use the published npm CLI or the local script rather than inventing raw requests.

## Install and tooling

Install the skill:

```powershell
npx skills add Ashwinning/refrens-api-skill
```

Explicit equivalent:

```powershell
npx skills add Ashwinning/refrens-api-skill --skill refrens-api
```

Because this repo contains one skill, `--skill refrens-api` is optional.

Run the published CLI:

```powershell
npx refrens-api-skill --help
```

From a local checkout of the skill:

```powershell
node .\scripts\refrens-api.js --help
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
npx refrens-api-skill check
```

### First-time setup

```powershell
npx refrens-api-skill setup
```

### Authenticate

```powershell
npx refrens-api-skill auth --approve-origin https://api.refrens.com
```

### Read invoices

```powershell
npx refrens-api-skill request GET '/businesses/:urlKey/invoices?$limit=5' --approve-origin https://api.refrens.com
```

### Preview an invoice creation

```powershell
npx refrens-api-skill request POST /businesses/:urlKey/invoices --body-file .\invoice.json --dry-run
```

### Preview a batch

```powershell
npx refrens-api-skill invoice-batch preview --input .\invoice-batch.json
```

## Batch invoices

Use `assets/invoice-batch.example.json` for an offline-friendly template, or `assets/invoice-batch.reference.example.json` when you want to copy defaults from an existing invoice. Do not add personal data, local absolute paths, or user-specific invoice entries to skill files.

## Notes

- preserve Refrens path prefixes exactly as documented
- never print credentials, tokens, or authorization headers
- do not assume undocumented retry guarantees
- stop when an endpoint or field is undocumented instead of guessing
