import { NextRequest } from "next/server";
import { extractToken, verifyTideJWT } from "@/lib/auth/tideJWT";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";
import { verifyDpop } from "@/lib/auth/verifyDpop";
import {
  currentPersona,
  errorResponse,
  localRequestAllowed,
  mode,
  publicPersona,
} from "@/lib/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (mode() === "live") {
    try {
      const token = extractToken(request.headers.get("authorization"));
      const claims = await verifyTideJWT(token);
      await verifyDpop(request, token, claims as { cnf?: { jkt?: string } }, {
        publicOrigin: process.env.TIDE_PUBLIC_ORIGIN || undefined,
      });

      const config = loadTideConfig();
      const clientRoles =
        (
          claims.resource_access as
            | Record<string, { roles?: string[] }>
            | undefined
        )?.[config.resource]?.roles ?? [];

      const hasMappedRole = (variable: string) => {
        const mapped = process.env[variable];
        return !!mapped && clientRoles.includes(mapped);
      };

      const audiences = [
        ...(hasMappedRole("TIDE_ROLE_PARTICIPANT") ? ["PARTICIPANT"] : []),
        ...(hasMappedRole("TIDE_ROLE_RESEARCH_ASSISTANT") ||
        hasMappedRole("TIDE_ROLE_HEAD_RESEARCHER")
          ? ["RESEARCHER"]
          : []),
        ...(hasMappedRole("TIDE_ROLE_HEAD_RESEARCHER") ||
        hasMappedRole("TIDE_ROLE_DATA_STEWARD") ||
        hasMappedRole("TIDE_ROLE_ETHICS_REPRESENTATIVE")
          ? ["GOVERNANCE"]
          : []),
      ];

      const capabilities = [
        ...(hasMappedRole("TIDE_ROLE_PARTICIPANT") ? ["record:read:own"] : []),
        ...(hasMappedRole("TIDE_ROLE_RESEARCH_ASSISTANT")
          ? ["study:read", "request:create"]
          : []),
        ...(hasMappedRole("TIDE_ROLE_HEAD_RESEARCHER")
          ? ["study:read", "governance:propose", "governance:approve"]
          : []),
        ...(hasMappedRole("TIDE_ROLE_DATA_STEWARD") ||
        hasMappedRole("TIDE_ROLE_ETHICS_REPRESENTATIVE")
          ? ["governance:approve"]
          : []),
      ];

      return Response.json({
        data: {
          id: claims.sub,
          label:
            typeof claims.preferred_username === "string"
              ? claims.preferred_username
              : "Verified Tide identity",
          audiences,
          capabilities,
          mode: "live",
          rolesMapped: audiences.length > 0,
        },
        meta: {
          mode: "live",
          source: "TIDE_CLOAK",
          verifiedAt: new Date().toISOString(),
          dpop: "VERIFIED",
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "Live session check rejected:",
          error instanceof Error ? error.message : "unknown error",
        );
      }
      return errorResponse(
        "SESSION_REQUIRED",
        "A valid Tide DPoP-bound session is required.",
        401,
      );
    }
  }

  if (!localRequestAllowed(request)) {
    return errorResponse(
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

  return Response.json({
    data: publicPersona(actor),
    meta: { mode: "local-simulation", source: "APPLICATION" },
  });
}
