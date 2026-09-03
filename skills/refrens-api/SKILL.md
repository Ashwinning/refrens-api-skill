---
name: refrens-api
description: Safely authenticate and work with the Refrens REST API for businesses, invoices, expenditures, payments, IRNs, leads, and clients. Use for Refrens API planning, reads, dry-runs, and reviewed mutations.
license: MIT
compatibility: Requires Node.js 18.18+ and network access to https://api.refrens.com
---

# Refrens API

Bundled local references are the first source for every currently supported Refrens route in this skill. Start with the markdown files under `references/`, stay inside the allowlist in `references/endpoint-matrix.md`, and use `references/route-reference.md` as the primary route guide.

Only consult the live Refrens docs when:

- the bundled local docs are insufficient for the supported route you are using
- a field or response shape does not match the local bundle
- a live call returns an error that the local bundle does not explain

Whenever you use live docs, cite the exact URL you opened.

## Before every live operation

1. If `.credentials` is missing, first read `references/getting-credentials.md` and either:
   - share this guide URL with the user before running setup: <https://github.com/Ashwinning/refrens-api-skill/blob/main/skills/refrens-api/references/getting-credentials.md>
   - ask the user for `app_id`, `app_secret`, and `url_key`, or
   - tell them to run `npx refrens-api-skill setup`
   - skip the guide-share step only if you are already using the browser yourself to collect the credentials for them
2. Read `references/endpoint-matrix.md` to confirm the route is allowlisted.
3. Read the matching section in `references/route-reference.md`.
4. Read `references/authentication.md` for token handling or the `/authentication` route.
5. Read `references/resource-notes.md` for shared resource caveats.
6. Read `references/safety-and-validation.md` before any `POST` or `PATCH`.
7. Only if the local bundle is insufficient, mismatched, or contradicted by a live error, open the route's fallback official URL and cite that exact URL.
8. Use the published npm CLI or the local script rather than inventing raw requests.

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
- before running setup for another user, first share the getting-credentials guide URL unless you are already fetching the values for them in the browser
- default base URL is `https://api.refrens.com`
- literal `:urlKey` placeholders are expanded from the credential file in memory
- supported routes are limited to the local allowlist in `references/endpoint-matrix.md`
- route-specific local details live in `references/route-reference.md`
- dry-runs print a redacted preview and a request-bound `confirmationHash`
- live `POST` and `PATCH` require the exact hash from the approved dry-run
- live auth and live requests require `--approve-origin` for the exact HTTPS origin
- tokens are kept in memory unless the user explicitly opts into the Windows DPAPI cache
- live docs are fallback-only for supported routes, and every live-doc check must cite the exact URL used

## Primary commands

### Validate local setup

```powershell
npx refrens-api-skill check
```

### First-time setup

Share this guide URL first unless you are already using the browser yourself to obtain the credentials:

<https://github.com/Ashwinning/refrens-api-skill/blob/main/skills/refrens-api/references/getting-credentials.md>

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
- stop when a route is outside the local allowlist instead of guessing
- for supported routes, start local-first and use the listed official fallback URL only when necessary
