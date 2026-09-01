# Contributing

Thanks for contributing.

## Development principles

- keep this project safe-by-default
- preserve exact documented Refrens path prefixes
- never log or print secrets, bearer tokens, or raw credential values
- require dry-run confirmation hashes for live `POST` and `PATCH`
- avoid hard-coded personal invoice data or environment-specific paths

## Local workflow

1. create a test `.credentials` file with non-production values
2. run:

   ```powershell
   npm test
   npm run pack:check
   ```

3. update docs when CLI behavior changes

## Repository structure

- `bin/` - npm bin entrypoint
- `skills/refrens-api/` - installable skill, scripts, references, and assets
- `tests/` - unit tests

## Pull request checklist

- [ ] tests updated for behavior changes
- [ ] README updated when commands or examples change
- [ ] reference docs updated when supported endpoints or safety rules change
- [ ] no credentials, tokens, or personal customer data included

## Scope expectations

Good changes:

- request safety improvements
- better redaction
- new documented endpoint coverage
- better invoice batch defaults/validation
- docs and publishing improvements

Please avoid unrelated refactors unless they are directly needed to support the change.
