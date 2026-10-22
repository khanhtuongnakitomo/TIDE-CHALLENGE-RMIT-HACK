import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { db, recordActivity } from "@/lib/db";
import { RESTRICTED_RECORD_IDS } from "@/lib/seed.server";
import {
  currentPersona,
  errorResponse,
  forbiddenMutationResponse,
  hasCapability,
  localRequestAllowed,
  mode,
  sameOriginMutation,
  unavailableResponse,
} from "@/lib/server";

export const runtime = "nodejs";

type Row = {
  id: string;
  requester_id: string;
  study_id: string;
  category: string;
  action: string;
  context_record_id: string;
  reason: string;
  state: string;
  governance_change_id: string | null;
};

function mapRequest(row: Row) {
  const approvals = db
    .prepare("SELECT COUNT(*) AS count FROM approvals WHERE request_id = ?")
    .get(row.id) as { count: number };

  return {
    id: row.id,
    requesterId: row.requester_id,
    scope: {
      kind: "STUDY_CATEGORY",
      studyId: row.study_id,
      dataCategory: row.category,
      action: row.action,
      contextRecordId: row.context_record_id,
    },
    reason: row.reason,
    state: row.state,
    governanceChangeId: row.governance_change_id,
    approvals: approvals.count,
    requiredApprovals: 2,
    source: "LOCAL_SIMULATION",
  };
}

export async function GET(request: NextRequest) {
  if (!localRequestAllowed(request)) {
    return mode() === "live"
      ? unavailableResponse()
      : errorResponse(
          "LOCAL_DEMO_DISABLED",
          "Use the loopback demo host.",
          404,
        );
  }

  const actor = await currentPersona();
  if (!actor) {
    return errorResponse(
      "SESSION_REQUIRED",
      "Select a local demo persona to continue.",
      401,
    );
  }

  if (actor.id === "participant-01") {
    return Response.json({
      data: [],
      meta: { mode: "local-simulation", source: "APPLICATION" },
    });
  }

  const rows =
    hasCapability(actor, "governance:approve") ||
    hasCapability(actor, "governance:propose")
      ? (db
          .prepare("SELECT * FROM access_requests ORDER BY created_at DESC")
          .all() as Row[])
      : (db
          .prepare(
            "SELECT * FROM access_requests WHERE requester_id = ? ORDER BY created_at DESC",
          )
          .all(actor.id) as Row[]);

  return Response.json({
    data: rows.map(mapRequest),
    meta: { mode: "local-simulation", source: "APPLICATION" },
  });
}

export async function POST(request: NextRequest) {
  if (!localRequestAllowed(request)) return unavailableResponse();
  if (!sameOriginMutation(request)) return forbiddenMutationResponse();

  const actor = await currentPersona();
  if (!actor) {
    return errorResponse(
      "SESSION_REQUIRED",
      "Select a local demo persona to continue.",
      401,
    );
  }

  if (!hasCapability(actor, "request:create")) {
    return errorResponse(
      "FORBIDDEN",
      "This persona cannot request research access.",
      403,
    );
  }

  let body: unknown;
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 4096) {
    return errorResponse("INVALID_INPUT", "Request body is too large.", 413);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) {
      return errorResponse("INVALID_INPUT", "Request body is too large.", 413);
    }
    body = JSON.parse(raw);
  } catch {
    return errorResponse("INVALID_INPUT", "Expected a JSON request.", 422);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(
      "INVALID_INPUT",
      "Expected an object with a scope and reason.",
      422,
    );
  }

  const b = body as { scope?: unknown; reason?: unknown };
  const bodyKeys = Object.keys(body);
  const scope = b.scope;

  if (
    bodyKeys.some((key) => key !== "scope" && key !== "reason") ||
    !scope ||
    typeof scope !== "object" ||
    Array.isArray(scope)
  ) {
    return errorResponse(
      "INVALID_INPUT",
      "Unknown or missing request fields.",
      422,
    );
  }

  const scopeObject = scope as Record<string, unknown>;
  const validContextRecord =
    typeof scopeObject.contextRecordId === "string" &&
    RESTRICTED_RECORD_IDS.includes(scopeObject.contextRecordId);

  if (
    Object.keys(scopeObject).some(
      (key) =>
        ![
          "kind",
          "studyId",
          "dataCategory",
          "action",
          "contextRecordId",
        ].includes(key),
    ) ||
    scopeObject.kind !== "STUDY_CATEGORY" ||
    scopeObject.studyId !== "study-wellbeing-01" ||
    scopeObject.dataCategory !== "RESTRICTED" ||
    scopeObject.action !== "READ" ||
    !validContextRecord ||
    typeof b.reason !== "string" ||
    b.reason.trim().length < 8 ||
    b.reason.trim().length > 500
  ) {
    return errorResponse(
      "INVALID_INPUT",
      "This demo accepts a study-level RESTRICTED READ request with a short reason.",
      422,
    );
  }

  const suppliedIdempotencyKey = request
    .headers.get("idempotency-key")
    ?.trim();
  if (
    suppliedIdempotencyKey &&
    (suppliedIdempotencyKey.length > 100 ||
      !/^[A-Za-z0-9._:-]+$/.test(suppliedIdempotencyKey))
  ) {
    return errorResponse(
      "INVALID_INPUT",
      "Idempotency-Key must be 1 to 100 safe characters.",
      422,
    );
  }

  const idempotencyKey =
    suppliedIdempotencyKey || randomBytes(16).toString("hex");
  const byKey = db
    .prepare(
      "SELECT * FROM access_requests WHERE requester_id = ? AND idempotency_key = ?",
    )
    .get(actor.id, idempotencyKey) as Row | undefined;

  if (byKey) {
    return Response.json({
      data: mapRequest(byKey),
      meta: {
        mode: "local-simulation",
        source: "APPLICATION",
        idempotentReplay: true,
      },
    });
  }

  const existing = db
    .prepare(
      "SELECT * FROM access_requests WHERE requester_id = ? AND study_id = 'study-wellbeing-01' AND category = 'RESTRICTED' AND action = 'READ' AND state IN ('REQUESTED','PENDING_GOVERNANCE','COMMITTED','ACTIVE')",
    )
    .get(actor.id) as Row | undefined;

  if (existing) {
    return Response.json(
      {
        error: {
          code: "REQUEST_ALREADY_PENDING",
          message: "An access request for this study category already exists.",
          requestId: existing.id,
        },
      },
      { status: 409 },
    );
  }

  const id = `request-${randomBytes(8).toString("hex")}`;
  db.prepare(
    "INSERT INTO access_requests(id, requester_id, study_id, category, action, context_record_id, reason, state, governance_change_id, idempotency_key, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    actor.id,
    "study-wellbeing-01",
    "RESTRICTED",
    "READ",
    scopeObject.contextRecordId as string,
    b.reason.trim(),
    "REQUESTED",
    null,
    idempotencyKey,
    new Date().toISOString(),
  );

  recordActivity(actor.id, "access.requested", "REQUESTED", id);
  const row = db
    .prepare("SELECT * FROM access_requests WHERE id = ?")
    .get(id) as Row;

  return Response.json(
    {
      data: mapRequest(row),
      meta: {
        mode: "local-simulation",
        source: "APPLICATION",
        correlationId: id,
      },
    },
    { status: 201 },
  );
}
