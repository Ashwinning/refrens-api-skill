# Authentication

Official sources:

- <https://www.refrens.com/api/docs/>
- <https://www.refrens.com/api/docs/authentication/>

This repository defaults the base URL to:

```text
https://api.refrens.com
```

Preserve the documented endpoint paths exactly as published on the Refrens docs.

## Getting API access and credentials

Refrens documents API access as something that must be enabled for the business account. Their public docs say premium users may need to contact support to enable API access.

Once API access is enabled, generate keys from the Refrens dashboard integration settings. Refrens help content describes the path as:

`Business Settings -> Integrations -> Accounting Integrations -> Generate API Keys`

If the local `.credentials` file does not exist yet, run `refrens-api setup` or `npx refrens-api-skill setup` and keep this guide open while you copy the values.

## Supported local credential names

The CLI reads these names from `.credentials`:

- `app_id` -> documented `appId`
- `app_secret` -> documented `appSecret`
- `private_key` -> optional ECDSA P-256 private key for self-signed JWT workflows outside this helper
- `url_key` -> business `urlKey` path value
- `base_url` -> optional base URL override

Never print their values.

## App-secret authentication

Send:

```http
POST /authentication
Content-Type: application/json
```

Body:

```json
{
  "strategy": "app-secret",
  "appId": "<appId>",
  "appSecret": "<appSecret>"
}
```

The response documents `accessToken`, `name`, and `appId`.

Local safety rules:

- keep `accessToken` in memory only by default
- never print the raw token
- send it as `Authorization: Bearer <token>` on protected calls
- when using this CLI, require explicit `--approve-origin` for the live host

## Token validation

Revalidate a bearer token with:

```http
POST /authentication
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "strategy": "app-token"
}
```

## Optional Windows token cache

This repository includes an explicit opt-in Windows-only token cache:

- cache file: `.refrens-token.dpapi`
- encryption: Windows user DPAPI
- commands:
  - `auth --persist-token`
  - `request --use-cached-token`
  - `request --persist-token`

It never writes the plaintext JWT to disk.

## Self-signed alternative

Refrens also documents ES256 self-signed JWT auth. Claims include:

```json
{
  "iss": "<appId>",
  "aud": "serana",
  "sub": "<appId>",
  "auth": {
    "entity": "app",
    "strategy": "app-iss-app-token"
  }
}
```

This repository does not generate self-signed JWTs directly; it stays with the simpler `app-secret` flow to keep the package lightweight and dependency-free.

## Error notes

- invalid authentication returns `401`
- permission issues can return `403 PERMISSION_DENIED`
- user-session tokens are not the documented auth mechanism for these app endpoints
