import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hasCapability,
  personas,
  type Persona,
  type PersonaId,
} from "@/lib/domain";

export const isLocalMode = () =>
  (process.env.RESEARCHVAULT_MODE ?? "local-simulation") === "local-simulation";

export const mode = () => (isLocalMode() ? "local-simulation" : "live");

const loopback = (host: string) =>
  /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);

export function localRequestAllowed(request: NextRequest): boolean {
  return (
    isLocalMode() &&
    loopback(request.headers.get("host") ?? "") &&
    loopback(request.nextUrl.hostname)
  );
}

export function sameOriginMutation(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  if (
    !origin ||
    !localRequestAllowed(request) ||
    !loopback(host) ||
    request.nextUrl.protocol !== "http:"
  ) {
    return false;
  }
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.protocol === "http:" &&
      parsed.host === host
    );
  } catch {
    return false;
  }
}

export function unavailableResponse() {
  return Response.json(
    {
      error: {
        code: "LIVE_DATA_BOUNDARY_UNAVAILABLE",
        message:
          "The live identity adapter may be available, but this application has no verified Tide shared-payload and governed-grant path. No local simulation fallback is used.",
      },
    },
    { status: 503 },
  );
}

export function modeDeniedResponse() {
  return Response.json(
    {
      error: {
        code: "LOCAL_DEMO_DISABLED",
        message:
          "The local simulation endpoint is disabled in live mode or from a non-loopback host.",
      },
    },
    { status: 404 },
  );
}

export function forbiddenMutationResponse() {
  return Response.json(
    {
      error: {
        code: "CSRF_ORIGIN_REJECTED",
        message: "This request must come from the local demo origin.",
      },
    },
    { status: 403 },
  );
}

export function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    {
      error: {
        code,
        message,
        correlationId: randomBytes(8).toString("hex"),
      },
    },
    { status },
  );
}

export function personaById(id: string | undefined): Persona | null {
  return personas.find((persona) => persona.id === id) ?? null;
}

export async function currentPersona(): Promise<Persona | null> {
  if (!isLocalMode()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get("rv_session")?.value;
  if (!token) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = db
    .prepare("SELECT persona_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(tokenHash) as { persona_id: string; expires_at: number } | undefined;

  if (!row || row.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return personaById(row.persona_id);
}

export async function createDemoSession(
  personaId: PersonaId,
  response: NextResponse,
): Promise<void> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get("rv_session")?.value;
  if (existingToken) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      createHash("sha256").update(existingToken).digest("hex"),
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  db.prepare(
    "INSERT INTO sessions(token_hash, persona_id, expires_at) VALUES(?, ?, ?)",
  ).run(tokenHash, personaId, Date.now() + 12 * 60 * 60 * 1000);

  response.cookies.set("rv_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function clearDemoSession(response: NextResponse): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("rv_session")?.value;
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      createHash("sha256").update(token).digest("hex"),
    );
  }
  response.cookies.set("rv_session", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 0,
  });
}

export function publicPersona(persona: Persona) {
  return {
    id: persona.id,
    label: persona.label,
    audiences: persona.audiences,
    capabilities: persona.capabilities,
    summary: persona.summary,
    mode: "local-simulation",
  };
}

export { hasCapability };
