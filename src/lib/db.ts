import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { study } from "./domain.ts";
import { seedRecords } from "./seed.server.ts";
import { seal } from "./crypto.ts";

const dataDir = resolve(
  process.env.RESEARCHVAULT_DATA_DIR ?? join(process.cwd(), ".data"),
);
const keyPath = join(dataDir, "demo.key");

let connection: DatabaseSync | undefined;
let cachedKey: Buffer | undefined;

export function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  mkdirSync(dataDir, { recursive: true });
  try {
    cachedKey = readFileSync(keyPath);
  } catch {
    try {
      writeFileSync(keyPath, randomBytes(32), { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    cachedKey = readFileSync(keyPath);
  }
  return cachedKey;
}

function getConnection(): DatabaseSync {
  if (connection) return connection;
  mkdirSync(dataDir, { recursive: true });
  const opened = new DatabaseSync(join(dataDir, "researchvault.sqlite"));

  try {
    opened.exec(
      "PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;",
    );
    opened.exec(`
      CREATE TABLE IF NOT EXISTS studies (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS study_members (
        study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
        persona_id TEXT NOT NULL,
        PRIMARY KEY(study_id, persona_id)
      );
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        study_id TEXT NOT NULL REFERENCES studies(id),
        owner_id TEXT NOT NULL,
        category TEXT NOT NULL,
        safe_label TEXT NOT NULL,
        ciphertext TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        persona_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        study_id TEXT NOT NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        context_record_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        state TEXT NOT NULL,
        governance_change_id TEXT,
        idempotency_key TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(requester_id, idempotency_key)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_open_scope_per_requester
        ON access_requests(requester_id, study_id, category, action)
        WHERE state IN ('REQUESTED','PENDING_GOVERNANCE','COMMITTED','ACTIVE');
      CREATE TABLE IF NOT EXISTS approvals (
        request_id TEXT NOT NULL REFERENCES access_requests(id) ON DELETE CASCADE,
        approver_id TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        PRIMARY KEY(request_id, approver_id)
      );
      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        actor_id TEXT,
        action TEXT NOT NULL,
        source TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        result TEXT NOT NULL
      );
    `);

    const seedKey = getEncryptionKey();
    opened
      .prepare(
        "INSERT OR IGNORE INTO studies(id, title, description) VALUES(?, ?, ?)",
      )
      .run(study.id, study.title, study.description);

    const recordExists = opened.prepare("SELECT id FROM records WHERE id = ?");
    const insertRecord = opened.prepare(
      "INSERT INTO records(id, study_id, owner_id, category, safe_label, ciphertext) VALUES(?, ?, ?, ?, ?, ?)",
    );

    for (const record of seedRecords) {
      if (!recordExists.get(record.id)) {
        const ciphertext = seal(
          record.plaintext,
          seedKey,
          `${record.id}|${study.id}|${record.category}`,
        );
        insertRecord.run(
          record.id,
          study.id,
          record.ownerId,
          record.category,
          record.safeLabel,
          JSON.stringify(ciphertext),
        );
      }
    }

    opened
      .prepare(
        "INSERT OR IGNORE INTO study_members(study_id, persona_id) VALUES(?, ?)",
      )
      .run(study.id, "assistant-01");
    opened
      .prepare(
        "INSERT OR IGNORE INTO study_members(study_id, persona_id) VALUES(?, ?)",
      )
      .run(study.id, "head-01");

    connection = opened;
    return opened;
  } catch (error) {
    opened.close();
    throw error;
  }
}

// Keep route imports side-effect free. Next loads route modules concurrently while building;
// opening/migrating the same SQLite database at import time can race and lock the build.
export const db = new Proxy({} as DatabaseSync, {
  get(_target, property) {
    const current = getConnection();
    const value: unknown = Reflect.get(current, property, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});

export function hasStudyMembership(personaId: string, studyId: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM study_members WHERE study_id = ? AND persona_id = ?")
    .get(studyId, personaId);
}

export function recordActivity(
  actorId: string | null,
  action: string,
  result: string,
  correlationId = randomBytes(8).toString("hex"),
): void {
  db.prepare(
    "INSERT INTO activity(id, occurred_at, actor_id, action, source, correlation_id, result) VALUES(?, ?, ?, ?, ?, ?, ?)",
  ).run(
    randomBytes(12).toString("hex"),
    new Date().toISOString(),
    actorId,
    action,
    "APPLICATION",
    correlationId,
    result,
  );
}

export const resetDemo = (): void => {
  db.exec(
    "DELETE FROM approvals; DELETE FROM access_requests; DELETE FROM sessions; DELETE FROM activity;",
  );
  db.exec("DELETE FROM records; DELETE FROM study_members; DELETE FROM studies;");
  db.prepare(
    "INSERT INTO studies(id, title, description) VALUES(?, ?, ?)",
  ).run(study.id, study.title, study.description);
  db.prepare(
    "INSERT INTO study_members(study_id, persona_id) VALUES(?, ?)",
  ).run(study.id, "assistant-01");
  db.prepare(
    "INSERT INTO study_members(study_id, persona_id) VALUES(?, ?)",
  ).run(study.id, "head-01");

  const insert = db.prepare(
    "INSERT INTO records(id, study_id, owner_id, category, safe_label, ciphertext) VALUES(?, ?, ?, ?, ?, ?)",
  );
  const key = getEncryptionKey();
  for (const record of seedRecords) {
    insert.run(
      record.id,
      study.id,
      record.ownerId,
      record.category,
      record.safeLabel,
      JSON.stringify(
        seal(
          record.plaintext,
          key,
          `${record.id}|${study.id}|${record.category}`,
        ),
      ),
    );
  }
};
