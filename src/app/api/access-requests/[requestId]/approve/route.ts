import { NextRequest } from "next/server";
import { db, recordActivity } from "@/lib/db";
import {
  currentPersona,
  errorResponse,
  forbiddenMutationResponse,
  hasCapability,
  localRequestAllowed,
  sameOriginMutation,
  unavailableResponse,
} from "@/lib/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
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

  if (!hasCapability(actor, "governance:approve")) {
    return errorResponse(
      "FORBIDDEN",
      "This persona cannot approve governance changes.",
      403,
    );
  }

  const { requestId } = await context.params;
  const row = db
    .prepare(
      "SELECT state, requester_id, governance_change_id FROM access_requests WHERE id = ?",
    )
    .get(requestId) as
    | {
        state: string;
        requester_id: string;
        governance_change_id: string | null;
      }
    | undefined;

  if (!row) {
    return errorResponse("NOT_FOUND", "Request is unavailable.", 404);
  }

  if (actor.id === row.requester_id) {
    return errorResponse(
      "FORBIDDEN",
      "A requester cannot approve their own access request.",
      403,
    );
  }

  if (row.state !== "PENDING_GOVERNANCE" || !row.governance_change_id) {
    return errorResponse(
      "STATE_CONFLICT",
      "The request is not awaiting simulated governance approval.",
      409,
    );
  }

  const prior = db
    .prepare(
      "SELECT 1 FROM approvals WHERE request_id = ? AND approver_id = ?",
    )
    .get(requestId, actor.id);

  if (prior) {
    return errorResponse(
      "ALREADY_APPROVED",
      "This governance persona has already approved this change.",
      409,
    );
  }

  db.prepare(
    "INSERT INTO approvals(request_id, approver_id, approved_at) VALUES(?, ?, ?)",
  ).run(requestId, actor.id, new Date().toISOString());

  const count = (
    db
      .prepare("SELECT COUNT(*) AS count FROM approvals WHERE request_id = ?")
      .get(requestId) as { count: number }
  ).count;

  const state = count >= 2 ? "COMMITTED" : "PENDING_GOVERNANCE";
  if (state === "COMMITTED") {
    db.prepare(
      "UPDATE access_requests SET state = ? WHERE id = ? AND state = 'PENDING_GOVERNANCE'",
    ).run(state, requestId);
  }

  recordActivity(
    actor.id,
    "governance.change.approved",
    state === "COMMITTED" ? "SIMULATED_COMMITTED" : "SIMULATED_PENDING",
    requestId,
  );

  return Response.json({
    data: {
      requestId,
      state,
      governanceChangeId: row.governance_change_id,
      approvals: count,
      requiredApprovals: 2,
      approverId: actor.id,
    },
    meta: { mode: "local-simulation", source: "LOCAL_SIMULATION" },
  });
}
