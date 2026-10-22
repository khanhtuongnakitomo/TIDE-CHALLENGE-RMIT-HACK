import test from "node:test";
import assert from "node:assert/strict";
import { publicTideConfig } from "../src/lib/auth/publicConfig.ts";

test("public Tide config preserves complete validated origin bindings and strips private adapter data", () => {
  const previous = process.env.CLIENT_ADAPTER;
  process.env.CLIENT_ADAPTER = JSON.stringify({
    realm: "researchvault",
    "auth-server-url": "http://127.0.0.1:8080",
    "ssl-required": "none",
    resource: "researchvault-web",
    "public-client": true,
    "confidential-port": 0,
    jwk: { keys: [{ kty: "EC", kid: "public-kid", use: "sig", alg: "ES256", x: "public-x", y: "public-y", d: "private-d" }] },
    "client-origin-auth-http://127.0.0.1:3100": "registered-loopback-origin",
    "client-origin-auth-https://researchvault.example": true,
    "client-origin-auth-http://127.0.0.1:3100/path": "invalid-path",
    "client-origin-auth-invalid": "invalid-origin",
    client_secret: "private-client-secret",
  });

  try {
    const config = publicTideConfig();
    assert.equal(config["client-origin-auth-http://127.0.0.1:3100"], "registered-loopback-origin");
    assert.equal(config["client-origin-auth-https://researchvault.example"], true);
    assert.equal("client-origin-auth-http://127.0.0.1:3100/path" in config, false);
    assert.equal("client-origin-auth-invalid" in config, false);
    assert.equal("client_secret" in config, false);
    assert.deepEqual(config.jwk, {
      keys: [{ kty: "EC", kid: "public-kid", use: "sig", alg: "ES256", x: "public-x", y: "public-y" }],
    });
  } finally {
    if (previous === undefined) delete process.env.CLIENT_ADAPTER;
    else process.env.CLIENT_ADAPTER = previous;
  }
});
