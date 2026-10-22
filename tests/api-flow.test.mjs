import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { requestHtu } from "../src/lib/auth/verifyDpop.ts";

const root = process.cwd();
const originFor = (port) => `http://127.0.0.1:${port}`;

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + 90_000;
  const readinessChanges = [];
  let lastReadiness = "not attempted";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next exited (${child.exitCode}):\n${logs.join("")}`);
    try {
      const response = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(1500) });
      const body = (await response.text()).slice(0, 512);
      const state = `HTTP ${response.status}${body ? ` ${body}` : ""}`;
      if (state !== lastReadiness) {
        readinessChanges.push(state);
        lastReadiness = state;
      }
      if (response.ok) return;
    } catch (error) {
      const state = `fetch ${error?.name ?? "Error"}: ${error?.message ?? String(error)}`;
      if (state !== lastReadiness) {
        readinessChanges.push(state);
        lastReadiness = state;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  let finalProbe = "unavailable";
  try {
    const response = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(5000) });
    finalProbe = `HTTP ${response.status} ${(await response.text()).slice(0, 512)}`;
  } catch (error) {
    finalProbe = `fetch ${error?.name ?? "Error"}: ${error?.message ?? String(error)}`;
  }
  throw new Error(`Next did not become ready (final status probe: ${finalProbe}; readiness changes: ${JSON.stringify(readinessChanges)}):\n${logs.join("")}`);
}

test("HTTP sessions enforce the scoped 2-of-3 local workflow and keep payloads private", { timeout: 150_000 }, async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "researchvault-api-"));
  const port = await freePort();
  const distDir = `.next-test-${process.pid}-${port}`;
  const origin = originFor(port);
  const logs = [];
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, RESEARCHVAULT_MODE: "local-simulation", RESEARCHVAULT_DATA_DIR: dataDir, NEXT_DIST_DIR: distDir, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  t.after(async () => {
    if (child.exitCode === null) {
      if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    }
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
    for (let attempt = 0; attempt < 8; attempt++) {
      try { await rm(dataDir, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 7 || error.code !== "EBUSY") throw error; await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    const distPath = join(root, distDir);
    if (!distPath.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)) throw new Error("Refusing to clean test output outside the repository.");
    await rm(distPath, { recursive: true, force: true });
  });
  await waitForServer(origin, child, logs);

  const json = async (path, { cookie, method = "GET", body, headers = {} } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(method !== "GET" ? { origin, "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, data: await response.json(), cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") };
  };
  const login = async (personaId, cookie = "") => {
    const result = await json("/api/demo/login", { method: "POST", cookie, body: { personaId } });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.match(result.cookie, /^rv_session=/);
    return result.cookie;
  };

  const home = await fetch(`${origin}/`);
  assert.equal(home.status, 200, "the actual local UI must render");
  assert.match(await home.text(), /ResearchVault/);

  const outsider = await fetch(`${origin}/api/demo/login`, { method: "POST", headers: { origin: "https://attacker.invalid", "content-type": "application/json" }, body: JSON.stringify({ personaId: "assistant-01" }) });
  assert.equal(outsider.status, 403, "local demo mutations reject cross-origin requests");

  const assistantCookie = await login("assistant-01");
  const listed = await json("/api/records", { cookie: assistantCookie });
  assert.equal(listed.response.status, 200);
  assert.ok(listed.data.data.some((record) => record.id === "record-coded-001" && !record.content));
  const denied = await json("/api/records/record-coded-001", { cookie: assistantCookie });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.data.error.code, "MISSING_SCOPE");
  assert.doesNotMatch(JSON.stringify(denied.data), /Synthetic coded response|participant response/);

  const malformed = await json("/api/access-requests", { cookie: assistantCookie, method: "POST", body: null });
  assert.equal(malformed.response.status, 422, "null JSON is rejected as input, not a server error");
  const massAssignment = await json("/api/access-requests", { cookie: assistantCookie, method: "POST", body: { role: "head", approvals: 2, state: "COMMITTED", requesterId: "assistant-01", scope: { kind: "STUDY_CATEGORY", studyId: "study-wellbeing-01", dataCategory: "RESTRICTED", action: "READ", contextRecordId: "record-coded-001" }, reason: "Need the coded response for analysis" } });
  assert.equal(massAssignment.response.status, 422);

  const request = await json("/api/access-requests", { cookie: assistantCookie, method: "POST", headers: { "idempotency-key": "flow-test-1" }, body: { scope: { kind: "STUDY_CATEGORY", studyId: "study-wellbeing-01", dataCategory: "RESTRICTED", action: "READ", contextRecordId: "record-coded-001" }, reason: "Need the coded response for analysis" } });
  assert.equal(request.response.status, 201);
  const replay = await json("/api/access-requests", { cookie: assistantCookie, method: "POST", headers: { "idempotency-key": "flow-test-1" }, body: { scope: { kind: "STUDY_CATEGORY", studyId: "study-wellbeing-01", dataCategory: "RESTRICTED", action: "READ", contextRecordId: "record-coded-001" }, reason: "Need the coded response for analysis" } });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.data.id, request.data.data.id);
  assert.equal(replay.data.meta.idempotentReplay, true);
  const ownRequests = await json("/api/access-requests", { cookie: assistantCookie });
  assert.equal(ownRequests.data.data.length, 1, "requester can see their own pending request");

  // A row in another study with no membership must not inherit broad study:read.
  const database = new DatabaseSync(join(dataDir, "researchvault.sqlite"));
  database.prepare("INSERT INTO studies(id,title,description) VALUES(?,?,?)").run("study-other-01", "Other study", "Test-only scope");
  database.prepare("INSERT INTO records(id,study_id,owner_id,category,safe_label,ciphertext) VALUES(?,?,?,?,?,?)").run("other-study-record", "study-other-01", "participant-02", "INTERNAL", "Other study", "{}");
  database.close();
  const otherStudy = await json("/api/records?studyId=study-other-01", { cookie: assistantCookie });
  assert.equal(otherStudy.response.status, 404);
  const otherRecord = await json("/api/records/other-study-record", { cookie: assistantCookie });
  assert.equal(otherRecord.response.status, 404);

  const headCookie = await login("head-01", assistantCookie);
  const staleAssistant = await json("/api/me", { cookie: assistantCookie });
  assert.equal(staleAssistant.response.status, 401, "switching personas invalidates the previous session");
  const proposal = await json(`/api/access-requests/${request.data.data.id}/propose`, { cookie: headCookie, method: "POST", body: {} });
  assert.equal(proposal.data.data.approvals, 0);
  const stillDenied = await json("/api/records/record-coded-001", { cookie: headCookie });
  assert.equal(stillDenied.response.status, 403, "head governance rights alone do not unlock restricted payloads");

  const stewardCookie = await login("steward-01", headCookie);
  const firstApproval = await json(`/api/access-requests/${request.data.data.id}/approve`, { cookie: stewardCookie, method: "POST", body: {} });
  assert.equal(firstApproval.data.data.approvals, 1);
  assert.equal(firstApproval.data.data.state, "PENDING_GOVERNANCE");
  const duplicate = await json(`/api/access-requests/${request.data.data.id}/approve`, { cookie: stewardCookie, method: "POST", body: {} });
  assert.equal(duplicate.response.status, 409, "the same approver cannot satisfy quorum twice");

  const pendingAssistantCookie = await login("assistant-01", stewardCookie);
  const pendingRead = await json("/api/records/record-coded-001", { cookie: pendingAssistantCookie });
  assert.equal(pendingRead.response.status, 403, "one approval leaves the payload locked");
  const pendingRequestView = await json("/api/access-requests", { cookie: pendingAssistantCookie });
  assert.equal(pendingRequestView.data.data[0].approvals, 1);

  const ethicsCookie = await login("ethics-01", pendingAssistantCookie);
  const secondApproval = await json(`/api/access-requests/${request.data.data.id}/approve`, { cookie: ethicsCookie, method: "POST", body: {} });
  assert.equal(secondApproval.data.data.approvals, 2);
  assert.equal(secondApproval.data.data.state, "COMMITTED");

  const assistantAfterApproval = await login("assistant-01", ethicsCookie);
  const read = await json("/api/records/record-coded-001", { cookie: assistantAfterApproval });
  assert.equal(read.response.status, 200);
  assert.match(read.data.data.content, /Synthetic response/);
  const active = await json("/api/access-requests", { cookie: assistantAfterApproval });
  assert.equal(active.data.data[0].state, "ACTIVE");
  assert.equal(read.data.meta.source, "LOCAL_SIMULATION");

  const identity = await json("/api/records/record-identity-001", { cookie: assistantAfterApproval });
  assert.equal(identity.response.status, 403, "identity mapping stays denied even after coded-response access");
  const participantCookie = await login("participant-01", assistantAfterApproval);
  const ownIdentity = await json("/api/records/record-identity-001", { cookie: participantCookie });
  assert.equal(ownIdentity.response.status, 200, "a participant can read their own identity mapping");
  const anotherParticipants = await json("/api/records/other-study-record", { cookie: participantCookie });
  assert.equal(anotherParticipants.response.status, 404, "participants cannot enumerate another person's data");
});

test("live identity boundary validates realm JWT, client scope, and DPoP without local fallback", { timeout: 150_000 }, async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "researchvault-live-"));
  const port = await freePort();
  const origin = originFor(port);
  const distDir = `.next-test-${process.pid}-${port}`;
  const issuer = "https://issuer.example/realms/demo";
  const { privateKey: realmPrivate, publicKey: realmPublic } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const realmJwk = { ...realmPublic.export({ format: "jwk" }), kid: "realm-test", alg: "RS256", use: "sig" };
  const adapter = { realm: "demo", "auth-server-url": "https://issuer.example", "ssl-required": "all", resource: "researchvault", "public-client": true, "confidential-port": 0, jwk: { keys: [realmJwk] } };
  const logs = [];
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, RESEARCHVAULT_MODE: "live", RESEARCHVAULT_DATA_DIR: dataDir, NEXT_DIST_DIR: distDir, NEXT_TELEMETRY_DISABLED: "1", CLIENT_ADAPTER: JSON.stringify(adapter), TIDE_ROLE_HEAD_RESEARCHER: "head" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  t.after(async () => {
    if (child.exitCode === null) {
      if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    }
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
    for (let attempt = 0; attempt < 8; attempt++) {
      try { await rm(dataDir, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 7 || error.code !== "EBUSY") throw error; await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    const distPath = join(root, distDir);
    if (!distPath.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)) throw new Error("Refusing to clean test output outside the repository.");
    await rm(distPath, { recursive: true, force: true });
  });
  await waitForServer(origin, child, logs);

  const { privateKey: dpopPrivate, publicKey: dpopPublic } = await generateKeyPair("ES256");
  const dpopJwk = await exportJWK(dpopPublic);
  const jkt = await calculateJwkThumbprint(dpopJwk, "sha256");
  const issueToken = async ({ azp = "researchvault", access = {}, includeExp = true, includeIat = true } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { sub: "user-01", preferred_username: "Researcher", azp, cnf: { jkt }, ...(includeIat ? { iat: now } : {}), ...(includeExp ? { exp: now + 300 } : {}), ...access };
    return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "realm-test" }).setIssuer(issuer).sign(realmPrivate);
  };
  const proofFor = async (token, { htu = `${origin}/api/me`, jti = randomUUID() } = {}) => {
    const ath = createHash("sha256").update(token).digest("base64url");
    return new SignJWT({ jti, htm: "GET", htu, iat: Math.floor(Date.now() / 1000), ath })
      .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: dpopJwk }).sign(dpopPrivate);
  };
  const me = async (token, proof, extraHeaders = {}) => fetch(`${origin}/api/me`, { headers: { authorization: `DPoP ${token}`, ...(proof ? { dpop: proof } : {}), ...extraHeaders } });

  assert.equal(requestHtu({ url: `http://localhost:${port}/api/me`, headers: { get: (name) => name === "host" ? `127.0.0.1:${port}` : name === "x-forwarded-host" ? "attacker.invalid" : null } }), `${origin}/api/me`, "normalized Next URL uses the validated loopback Host and ignores spoofed forwarding headers");
  assert.throws(() => requestHtu({ url: `http://localhost:${port}/api/me`, headers: { get: (name) => name === "host" ? `attacker@127.0.0.1:${port}` : null } }), /loopback/, "userinfo syntax is not accepted as a loopback Host");

  const missingProofToken = await issueToken();
  assert.equal((await me(missingProofToken)).status, 401, "a signed JWT alone cannot establish a live session");
  const noExpToken = await issueToken({ includeExp: false });
  assert.equal((await me(noExpToken, await proofFor(noExpToken))).status, 401, "exp is required");
  const noIatToken = await issueToken({ includeIat: false });
  assert.equal((await me(noIatToken, await proofFor(noIatToken))).status, 401, "iat is required");
  const wrongClientToken = await issueToken({ azp: "unrelated-client" });
  assert.equal((await me(wrongClientToken, await proofFor(wrongClientToken))).status, 401, "azp must equal the configured app client");
  const expiredToken = await new SignJWT({ sub: "user-01", azp: "researchvault", cnf: { jkt }, iat: Math.floor(Date.now() / 1000) - 600, exp: Math.floor(Date.now() / 1000) - 300 }).setProtectedHeader({ alg: "RS256", kid: "realm-test" }).setIssuer(issuer).sign(realmPrivate);
  assert.equal((await me(expiredToken, await proofFor(expiredToken))).status, 401, "expired realm tokens are rejected");

  const wrongRoleScopeToken = await issueToken({ access: { resource_access: { "unrelated-client": { roles: ["head"] } } } });
  const wrongHtuProof = await proofFor(wrongRoleScopeToken, { htu: `${origin}/api/not-me` });
  assert.equal((await me(wrongRoleScopeToken, wrongHtuProof)).status, 401, "DPoP htu must match the request path");
  const wrongRoleProof = await proofFor(wrongRoleScopeToken);
  // A forged forwarding header must not override the direct loopback Host signed by the client.
  const wrongRole = await me(wrongRoleScopeToken, wrongRoleProof, { "x-forwarded-host": "attacker.invalid" });
  assert.equal(wrongRole.status, 200, `${await wrongRole.clone().text()}\n${logs.join("")}`);
  assert.equal((await wrongRole.json()).data.rolesMapped, false, "same-named role from another client does not grant app authority");
  assert.equal((await me(wrongRoleScopeToken, wrongRoleProof)).status, 401, "a DPoP proof cannot be replayed");

  const intendedRoleToken = await issueToken({ access: { resource_access: { researchvault: { roles: ["head"] } } } });
  const intendedRole = await me(intendedRoleToken, await proofFor(intendedRoleToken));
  assert.equal(intendedRole.status, 200);
  const mapped = await intendedRole.json();
  assert.equal(mapped.data.rolesMapped, true);
  assert.ok(mapped.data.capabilities.includes("governance:propose"));
  assert.equal((await fetch(`${origin}/api/records`)).status, 503, "live data boundary is explicitly unavailable");
  const localLogin = await fetch(`${origin}/api/demo/login`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ personaId: "assistant-01" }) });
  assert.equal(localLogin.status, 503, "live mode never falls back to synthetic personas");
});
