import { NextRequest } from "next/server";
import { study } from "@/lib/domain";
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
    !actor.audiences.includes("PARTICIPANT") &&
    !hasCapability(actor, "study:read")
  ) {
    return errorResponse(
      "NOT_FOUND",
      "Study is unavailable to this persona.",
      404,
    );
  }

  return Response.json({
    data: [study],
    meta: { mode: "local-simulation", source: "APPLICATION" },
  });
}
