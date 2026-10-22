import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  currentPersona,
  errorResponse,
  hasCapability,
  localRequestAllowed,
  mode,
  unavailableResponse,
} from "@/lib/server";

export const runtime = "nodejs";

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

  if (
    !hasCapability(actor, "governance:approve") &&
    !hasCapability(actor, "governance:propose")
  ) {
    return errorResponse(
      "FORBIDDEN",
      "Only governance personas can inspect this local event timeline.",
      403,
    );
  }

  const data = db
    .prepare(
      "SELECT occurred_at, actor_id, action, source, correlation_id, result FROM activity ORDER BY occurred_at DESC LIMIT 100",
    )
    .all();

  return Response.json({
    data,
    meta: {
      mode: "local-simulation",
      source: "APPLICATION",
      coverage: "Sanitised local application events only.",
    },
  });
}
