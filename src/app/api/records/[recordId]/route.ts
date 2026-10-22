import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { open, type Ciphertext } from "@/lib/crypto";
import {
  db,
  getEncryptionKey,
  hasStudyMembership,
  recordActivity,
} from "@/lib/db";
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
  ciphertext: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ recordId: string }> },
) {
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

  const { recordId } = await context.params;
  const row = db
    .prepare(
      "SELECT id, study_id, owner_id, category, safe_label, ciphertext FROM records WHERE id = ?",
    )
    .get(recordId) as Row | undefined;

  if (!row) {
    return errorResponse("NOT_FOUND", "Record is unavailable.", 404);
  }

  const own = actor.id === row.owner_id;
  if (actor.id === "participant-01" && !own) {
    return errorResponse("NOT_FOUND", "Record is unavailable.", 404);
  }

  const member = hasStudyMembership(actor.id, row.study_id);
  if (!own && !member) {
    return errorResponse("NOT_FOUND", "Record is unavailable.", 404);
  }

  const grant =
    row.category === "RESTRICTED"
      ? (db
          .prepare(
            "SELECT id, state FROM access_requests WHERE requester_id = ? AND study_id = ? AND category = 'RESTRICTED' AND action = 'READ' AND state IN ('COMMITTED','ACTIVE')",
          )
          .get(actor.id, row.study_id) as
          | { id: string; state: string }
          | undefined)
      : undefined;

  const permitted =
    own ||
    (member &&
      row.category === "INTERNAL" &&
      hasCapability(actor, "study:read")) ||
    (member && !!grant);

  if (!permitted) {
    recordActivity(actor.id, "record.read.denied", "MISSING_SCOPE");
    return errorResponse(
      "MISSING_SCOPE",
      "Additional permission is required for this data category.",
      403,
    );
  }

  try {
    const plaintext = open(
      JSON.parse(row.ciphertext) as Ciphertext,
      getEncryptionKey(),
      `${row.id}|${row.study_id}|${row.category}`,
    );

    if (grant && grant.state === "COMMITTED") {
      db.prepare(
        "UPDATE access_requests SET state = 'ACTIVE' WHERE id = ? AND state = 'COMMITTED'",
      ).run(grant.id);
    }

    recordActivity(actor.id, "record.read", "SIMULATED_LOCAL_DECRYPTION");
    return Response.json({
      data: {
        id: row.id,
        studyId: row.study_id,
        category: row.category,
        safeLabel: row.safe_label,
        content: plaintext,
      },
      meta: {
        mode: "local-simulation",
        source: "LOCAL_SIMULATION",
        crypto: "SERVER_HELD_LOCAL_DEMO_KEY",
        correlationId: randomUUID(),
      },
    });
  } catch {
    return errorResponse(
      "DECRYPTION_FAILED",
      "The local demo payload could not be opened.",
      503,
    );
  }
}
