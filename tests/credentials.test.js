import test from "node:test";
import assert from "node:assert/strict";
import { parseCredentialsText } from "../skills/refrens-api/scripts/lib/credentials.js";

test("parseCredentialsText supports export syntax, quoted values, and multiline private keys", () => {
  const credentials = parseCredentialsText(`
export app_id="demo-app"
app_secret='demo-secret'
url_key=my-business
private_key="-----BEGIN PRIVATE KEY-----
line-two
-----END PRIVATE KEY-----"
`);

  assert.equal(credentials.app_id, "demo-app");
  assert.equal(credentials.app_secret, "demo-secret");
  assert.equal(credentials.url_key, "my-business");
  assert.equal(
    credentials.private_key,
    "-----BEGIN PRIVATE KEY-----\nline-two\n-----END PRIVATE KEY-----"
  );
});

test("parseCredentialsText rejects duplicate names", () => {
  assert.throws(
    () =>
      parseCredentialsText(`
app_id="one"
app_id="two"
`),
    /Duplicate credential name/
  );
});
