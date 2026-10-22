import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordActivity, resetDemo } from "@/lib/db";
import {
  createDemoSession,
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

  const previousActor = await currentPersona();
  resetDemo();

  const response = NextResponse.json({
    data: {
      reset: true,
      activePersonaId: previousActor?.id ?? null,
    },
    meta: {
      mode: "local-simulation",
      source: "APPLICATION",
      correlationId: randomBytes(8).toString("hex"),
    },
  });

  if (previousActor) {
    await createDemoSession(previousActor.id, response);
    recordActivity(previousActor.id, "demo.state.reset", "SIMULATED");
  }

  return response;
}
