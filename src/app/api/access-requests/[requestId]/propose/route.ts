import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
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

  if (!hasCapability(actor, "governance:propose")) {
    return errorResponse(
      "FORBIDDEN",
      "Only the head researcher can propose this change in the local demo.",
      403,
    );
  }

  const { requestId } = await context.params;
  const row = db
    .prepare(
      "SELECT requester_id, state, governance_change_id FROM access_requests WHERE id = ?",
    )
    .get(requestId) as
    | {
        requester_id: string;
        state: string;
        governance_change_id: string | null;
      }
    | undefined;

  if (!row) {
    return errorResponse("NOT_FOUND", "Request is unavailable.", 404);
  }

  if (row.state === "PENDING_GOVERNANCE") {
    const approvals = (
      db
        .prepare("SELECT COUNT(*) AS count FROM approvals WHERE request_id = ?")
        .get(requestId) as { count: number }
    ).count;

    return Response.json({
      data: {
        requestId,
        state: row.state,
        governanceChangeId: row.governance_change_id,
        approvals,
        requiredApprovals: 2,
      },
      meta: { mode: "local-simulation", source: "LOCAL_SIMULATION" },
    });
  }

  if (row.state !== "REQUESTED") {
    return errorResponse(
      "STATE_CONFLICT",
      "Only an unreviewed request can be proposed.",
      409,
    );
  }

  const changeId = `simulated-change-${randomBytes(8).toString("hex")}`;
  db.prepare(
    "UPDATE access_requests SET state = 'PENDING_GOVERNANCE', governance_change_id = ? WHERE id = ? AND state = 'REQUESTED'",
  ).run(changeId, requestId);

  recordActivity(
    actor.id,
    "governance.change.proposed",
    "SIMULATED_PENDING",
    requestId,
  );

  return Response.json({
    data: {
      requestId,
      state: "PENDING_GOVERNANCE",
      governanceChangeId: changeId,
      approvals: 0,
      requiredApprovals: 2,
    },
    meta: { mode: "local-simulation", source: "LOCAL_SIMULATION" },
  });
}
