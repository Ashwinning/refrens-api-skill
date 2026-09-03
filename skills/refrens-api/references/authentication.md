# Authentication

This is the bundled auth route reference for the skill. Start here for the supported `/authentication` flow and for token-handling rules used by the other allowlisted routes.

Use the fallback official auth docs only when this local guide is insufficient, the returned auth shape differs, or an auth error needs confirmation. Whenever you do, cite the exact URL used.

Fallback official URLs:

- <https://www.refrens.com/api/docs/authentication/>
- <https://www.refrens.com/api/docs/authentication/#create-token>
- <https://www.refrens.com/api/docs/authentication/#auth-revalidation>

This CLI defaults the base URL to:

```text
https://api.refrens.com
```

Preserve the documented endpoint paths exactly as published.

## Getting API access and credentials

Refrens documents API access as something that must be enabled for the business account. Their public docs say premium users may need to contact support to enable API access.

Once API access is enabled, generate keys from the Refrens dashboard integration settings. Refrens help content describes the path as:

`Business Settings -> Integrations -> Accounting Integrations -> Generate API Keys`

If the local `.credentials` file does not exist yet, run `npx refrens-api-skill setup` and keep this guide open while you copy the values. For a local checkout of the skill, the explicit equivalent is `node .\scripts\refrens-api.js setup`.

If you are assisting another user, first share this guide URL before you run setup or ask them to paste credentials, unless you are already collecting the values for them directly in the browser:

<https://github.com/Ashwinning/refrens-api-skill/blob/main/skills/refrens-api/references/getting-credentials.md>

## Supported local credential names

The CLI reads these names from `.credentials`:

- `app_id` -> documented `appId`
- `app_secret` -> documented `appSecret`
- `private_key` -> optional ECDSA P-256 private key for self-signed JWT workflows outside this helper
- `url_key` -> business `urlKey` path value
- `base_url` -> optional base URL override

Never print their values.

## Bundled `/authentication` route summary

The skill uses the dedicated `auth` command for this route:

```powershell
npx refrens-api-skill auth --approve-origin https://api.refrens.com
```

Add `--validate` when you want the CLI to revalidate the issued token with the same endpoint.

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
- send it as `Authorization: ******` on protected calls
- when using this CLI, require explicit `--approve-origin` for the live host

## Token validation

Revalidate a bearer token with:

```http
POST /authentication
Authorization: ******
Content-Type: application/json
```

```json
{
  "strategy": "app-token"
}
```

## Optional Windows token cache

This CLI includes an explicit opt-in Windows-only token cache:

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

This skill does not generate self-signed JWTs directly; it stays with the simpler `app-secret` flow to keep the published package lightweight and dependency-free.

## Error notes

- invalid authentication returns `401`
- permission issues can return `403 PERMISSION_DENIED`
- user-session tokens are not the documented auth mechanism for these app endpoints
