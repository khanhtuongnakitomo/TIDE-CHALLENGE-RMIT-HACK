import { NextRequest, NextResponse } from "next/server";
import { recordActivity } from "@/lib/db";
import {
  clearDemoSession,
  currentPersona,
  forbiddenMutationResponse,
  localRequestAllowed,
  sameOriginMutation,
  unavailableResponse,
} from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!localRequestAllowed(request)) return unavailableResponse();
  if (!sameOriginMutation(request)) return forbiddenMutationResponse();

  const actor = await currentPersona();
  const response = NextResponse.json({
    data: { ok: true },
    meta: { mode: "local-simulation", source: "APPLICATION" },
  });

  await clearDemoSession(response);
  if (actor) {
    recordActivity(actor.id, "demo.session.ended", "SIMULATED");
  }

  return response;
}
