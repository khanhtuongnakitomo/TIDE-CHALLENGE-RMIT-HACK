import { NextRequest } from "next/server";
import { db, hasStudyMembership } from "@/lib/db";
import type { Category } from "@/lib/domain";
import {
  currentPersona,
  errorResponse,
  hasCapability,
  localRequestAllowed,
  mode,
  unavailableResponse,
} from "@/lib/server";

export const runtime = "nodejs";

type Row = {
  id: string;
  study_id: string;
  owner_id: string;
  category: Category;
  safe_label: string;
};

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

  const studyId =
    request.nextUrl.searchParams.get("studyId") ?? "study-wellbeing-01";
  if (!hasStudyMembership(actor.id, studyId) && actor.id !== "participant-01") {
    return errorResponse("NOT_FOUND", "Study is unavailable.", 404);
  }

  const rows = db
    .prepare(
      "SELECT id, study_id, owner_id, category, safe_label FROM records WHERE study_id = ? ORDER BY id",
    )
    .all(studyId) as Row[];

  const visible = rows.filter(
    (row) =>
      actor.id === row.owner_id ||
      (hasStudyMembership(actor.id, row.study_id) &&
        hasCapability(actor, "study:read")),
  );

  const data = visible.map((row) => {
    const grant = db
      .prepare(
        "SELECT state FROM access_requests WHERE requester_id = ? AND study_id = ? AND category = ? AND action = 'READ' AND state IN ('COMMITTED','ACTIVE')",
      )
      .get(actor.id, row.study_id, row.category) as
      | { state: string }
      | undefined;

    const own = actor.id === row.owner_id;
    const member = hasStudyMembership(actor.id, row.study_id);
    const permitted =
      own ||
      (member &&
        row.category === "INTERNAL" &&
        hasCapability(actor, "study:read")) ||
      (member && row.category === "RESTRICTED" && !!grant);
    const canRequest =
      row.category === "RESTRICTED" &&
      hasCapability(actor, "request:create") &&
      !grant;

    return {
      id: row.id,
      studyId: row.study_id,
      category: row.category,
      safeLabel: row.safe_label,
      access: {
        canRequest,
        mayAttemptDecrypt: permitted,
        reasonCode: permitted ? null : "MISSING_SCOPE",
      },
      simulatedGrantState: grant?.state ?? null,
    };
  });

  return Response.json({
    data,
    meta: { mode: "local-simulation", source: "APPLICATION" },
  });
}
