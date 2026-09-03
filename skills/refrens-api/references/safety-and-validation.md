# Safety and validation

## Before a live mutation

1. Confirm the method/path exists in the local allowlist in `endpoint-matrix.md`.
2. Read the matching local section in `route-reference.md`.
3. Read `authentication.md` if the call depends on token setup or uses `/authentication`.
4. Only if the local bundle is insufficient, a field or response shape mismatches, or the live call errors, open the route's official fallback URL and cite the exact URL used.
5. Preserve the exact documented path prefix.
6. Validate required fields, enums, identifiers, money values, dates, and `urlKey`.
7. Produce a sanitized preview.
8. Review the request summary and side effects.
9. Use the exact dry-run `confirmationHash`.
10. Supply the separately approved `--approve-origin` value.

If method, path, body, or origin changes, preview and confirm again.

## Retry boundaries

- `GET` may be retried conservatively.
- Do not blindly retry ambiguous mutations.
- Client create and lead create are only retry-safe with the documented idempotent identifiers and an identical payload.
- Lead comment/note batches are only retry-safe with the same `clientRequestId` and identical content.
- Payment `refId` is not documented as an idempotency key.
- This CLI performs a single fresh-auth retry for cached-token `GET` calls that fail with `401`.

## Secret handling

- never print credentials, PEM material, access tokens, or authorization headers
- do not place secrets in command-line arguments when a file-based option exists
- keep tokens in memory unless the Windows DPAPI cache is explicitly requested
- do not commit `.credentials` or `.refrens-token.dpapi`

## Response handling

- redact emails, phones, tax identifiers, banking fields, `urlKey`, and token-like fields
- prefer concise status + identifier output over raw response dumps
- if a live response contradicts the local bundle, check the fallback official URL and cite that exact URL before trusting the new shape
- stop on undocumented or unallowlisted routes rather than guessing

## Batch invoices

Batch creation is intentionally split into:

1. `invoice-batch preview`
2. review each invoice's `confirmationHash`
3. `invoice-batch create --confirm-hash key=hash ...`

The create command stops on first failure and prints any already-created items so the operator can reconcile partial completion safely.
