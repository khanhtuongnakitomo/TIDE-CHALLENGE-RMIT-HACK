import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordActivity } from "@/lib/db";
import { PERSONAS, type PersonaId } from "@/lib/domain";
import {
  createDemoSession,
  forbiddenMutationResponse,
  localRequestAllowed,
  personaById,
  publicPersona,
  sameOriginMutation,
  unavailableResponse,
} from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!localRequestAllowed(request)) return unavailableResponse();
  if (!sameOriginMutation(request)) return forbiddenMutationResponse();

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 1024) {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Login body is too large.",
        },
      },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Expected a JSON body.",
        },
      },
      { status: 422 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "personaId")
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Only personaId is accepted.",
        },
      },
      { status: 422 },
    );
  }

  const id =
    typeof body === "object" && body !== null && "personaId" in body
      ? (body as { personaId?: unknown }).personaId
      : undefined;

  if (typeof id !== "string" || !(PERSONAS as readonly string[]).includes(id)) {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Choose one of the five local demo personas.",
        },
      },
      { status: 422 },
    );
  }

  const persona = personaById(id)!;
  const response = NextResponse.json({
    data: publicPersona(persona),
    meta: {
      mode: "local-simulation",
      source: "APPLICATION",
      correlationId: randomBytes(8).toString("hex"),
    },
  });

  await createDemoSession(id as PersonaId, response);
  recordActivity(persona.id, "demo.session.started", "SIMULATED");
  return response;
}
