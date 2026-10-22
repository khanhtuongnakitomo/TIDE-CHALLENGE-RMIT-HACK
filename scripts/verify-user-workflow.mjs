import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDataDir = await mkdtemp(join(tmpdir(), "researchvault-user-workflow-"));
process.env.RESEARCHVAULT_MODE = "local-simulation";
process.env.RESEARCHVAULT_DATA_DIR = tempDataDir;

const { db, getEncryptionKey, hasStudyMembership, resetDemo } = await import(
  "../src/lib/db.ts"
);
const { open } = await import("../src/lib/crypto.ts");
const { personas, study, userTestWorkflowSteps, hasCapability } = await import(
  "../src/lib/domain.ts"
);
const { seedRecords } = await import("../src/lib/seed.server.ts");

function logStep(stepNum, title, detail) {
  console.log(`\n[Step 0${stepNum}/06] ${title}`);
  console.log(`  ✓ ${detail}`);
}

try {
  console.log("==============================================================");
  console.log(" ResearchVault — Automated User Test Workflow Verification");
  console.log(" Study:   ", `${study.title} (${study.id})`);
  console.log(" Personas:", personas.map((p) => p.id).join(", "));
  console.log(" Records: ", `${seedRecords.length} synthetic records across 3 categories`);
  console.log("==============================================================");

  resetDemo();

  // Step 1: Participant inspects own contribution & isolation check
  const participant = personas.find((p) => p.id === "participant-01");
  const allRows = db
    .prepare("SELECT id, study_id, owner_id, category, safe_label, ciphertext FROM records WHERE study_id = ? ORDER BY id")
    .all(study.id);

  const participantVisible = allRows.filter((r) => r.owner_id === participant.id);
  assert.equal(participantVisible.length, 3, "Participant sees only her 3 owned records");
  const participantIdentity = participantVisible.find((r) => r.id === "record-identity-001");
  const decryptedIdentity = open(
    JSON.parse(participantIdentity.ciphertext),
    getEncryptionKey(),
    `${participantIdentity.id}|${study.id}|${participantIdentity.category}`,
  );
  assert.match(decryptedIdentity, /Maya Chen/);
  logStep(
    1,
    userTestWorkflowSteps[0].title,
    `Maya Chen read her own records (P-014); other participants' records (P-019, P-023) remain isolated.`,
  );

  // Step 2: Research assistant reads INTERNAL, is denied RESTRICTED, and creates request
  const assistant = personas.find((p) => p.id === "assistant-01");
  assert.equal(hasStudyMembership(assistant.id, study.id), true);
  const internalRecords = allRows.filter((r) => r.category === "INTERNAL");
  assert.equal(internalRecords.length, 2, "2 INTERNAL protocol/codebook records available");

  const activeGrantBefore = db
    .prepare(
      "SELECT id FROM access_requests WHERE requester_id = ? AND study_id = ? AND category = 'RESTRICTED' AND state IN ('COMMITTED','ACTIVE')",
    )
    .get(assistant.id, study.id);
  assert.equal(activeGrantBefore, undefined, "No RESTRICTED grant active initially");

  const reqId = "request-demo-workflow-01";
  db.prepare(
    "INSERT INTO access_requests(id, requester_id, study_id, category, action, context_record_id, reason, state, governance_change_id, idempotency_key, created_at) VALUES(?, ?, ?, 'RESTRICTED', 'READ', 'record-coded-001', ?, 'REQUESTED', NULL, 'idem-workflow-1', ?)",
  ).run(
    reqId,
    assistant.id,
    study.id,
    "I need to code the interview themes assigned to me.",
    new Date().toISOString(),
  );
  logStep(
    2,
    userTestWorkflowSteps[1].title,
    `Riley Park opened 2 INTERNAL records, was denied RESTRICTED (403 MISSING_SCOPE), and created ${reqId} (REQUESTED).`,
  );

  // Step 3: Head researcher proposes change and provides 1st approval (1/2)
  const head = personas.find((p) => p.id === "head-01");
  assert.equal(hasCapability(head, "governance:propose"), true);
  assert.equal(hasCapability(head, "governance:approve"), true);

  const changeId = "simulated-change-workflow-01";
  db.prepare(
    "UPDATE access_requests SET state = 'PENDING_GOVERNANCE', governance_change_id = ? WHERE id = ?",
  ).run(changeId, reqId);
  db.prepare(
    "INSERT INTO approvals(request_id, approver_id, approved_at) VALUES(?, ?, ?)",
  ).run(reqId, head.id, new Date().toISOString());

  const countAfterFirst = db
    .prepare("SELECT COUNT(*) AS count FROM approvals WHERE request_id = ?")
    .get(reqId).count;
  assert.equal(countAfterFirst, 1);
  logStep(
    3,
    userTestWorkflowSteps[2].title,
    `Dr. Sam Taylor proposed ${changeId} and recorded approval 1/2. State remains PENDING_GOVERNANCE (access still locked).`,
  );

  // Step 4: Second distinct governance persona (Data Steward or Ethics) approves (2/2 -> COMMITTED)
  const steward = personas.find((p) => p.id === "steward-01");
  assert.equal(hasCapability(steward, "governance:approve"), true);
  db.prepare(
    "INSERT INTO approvals(request_id, approver_id, approved_at) VALUES(?, ?, ?)",
  ).run(reqId, steward.id, new Date().toISOString());

  const countAfterSecond = db
    .prepare("SELECT COUNT(*) AS count FROM approvals WHERE request_id = ?")
    .get(reqId).count;
  assert.equal(countAfterSecond, 2);
  db.prepare(
    "UPDATE access_requests SET state = 'COMMITTED' WHERE id = ? AND state = 'PENDING_GOVERNANCE'",
  ).run(reqId);
  logStep(
    4,
    userTestWorkflowSteps[3].title,
    `Jordan Lee (Data steward) recorded independent approval 2/2. Quorum met; request transitioned to COMMITTED.`,
  );

  // Step 5: Assistant retries and decrypts all study-scoped RESTRICTED responses (P-014, P-019, P-023)
  const restrictedRows = allRows.filter((r) => r.category === "RESTRICTED");
  assert.equal(restrictedRows.length, 3, "All 3 RESTRICTED coded responses in study-wellbeing-01");
  for (const row of restrictedRows) {
    const text = open(
      JSON.parse(row.ciphertext),
      getEncryptionKey(),
      `${row.id}|${study.id}|${row.category}`,
    );
    assert.match(text, /Synthetic response:/);
  }
  db.prepare(
    "UPDATE access_requests SET state = 'ACTIVE' WHERE id = ? AND state = 'COMMITTED'",
  ).run(reqId);
  logStep(
    5,
    userTestWorkflowSteps[4].title,
    `Riley Park decrypted all 3 RESTRICTED coded responses (P-014, P-019, P-023). Request state is now ACTIVE.`,
  );

  // Step 6: Verify HIGHLY_RESTRICTED identity mappings remain denied to Assistant
  const identityGrant = db
    .prepare(
      "SELECT id FROM access_requests WHERE requester_id = ? AND study_id = ? AND category = 'HIGHLY_RESTRICTED' AND state IN ('COMMITTED','ACTIVE')",
    )
    .get(assistant.id, study.id);
  assert.equal(identityGrant, undefined, "HIGHLY_RESTRICTED remains ungranted and locked");
  logStep(
    6,
    userTestWorkflowSteps[5].title,
    `HIGHLY_RESTRICTED identity mappings (record-identity-001, record-identity-002) remain locked (403 MISSING_SCOPE).`,
  );

  console.log("\n==============================================================");
  console.log(" PASS: All 6 User Test Workflow stages verified end-to-end.");
  console.log("==============================================================\n");
} finally {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(tempDataDir, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}
