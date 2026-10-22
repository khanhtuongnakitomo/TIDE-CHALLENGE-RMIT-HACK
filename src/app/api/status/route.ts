import { NextRequest } from "next/server";
import { mode, localRequestAllowed } from "@/lib/server";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  if (mode() === "live") {
    let authReady = false;
    try {
      const config = loadTideConfig();
      authReady = !!config.jwk?.keys?.length && !!config.resource;
    } catch {
      // Readiness response is deliberately explicit.
    }

    const roleMappingsConfigured = [
      "TIDE_ROLE_PARTICIPANT",
      "TIDE_ROLE_RESEARCH_ASSISTANT",
      "TIDE_ROLE_HEAD_RESEARCHER",
      "TIDE_ROLE_DATA_STEWARD",
      "TIDE_ROLE_ETHICS_REPRESENTATIVE",
    ].every((key) => !!process.env[key]);

    return Response.json(
      {
        data: {
          mode: "live",
          provider: authReady ? "TIDE_CLOAK" : "UNAVAILABLE",
          liveAuthReady: authReady,
          roleMappingsConfigured,
          protectedPayloadReady: false,
          governedGrantReady: false,
          localSimulationEnabled: false,
        },
      },
      { status: authReady ? 200 : 503 },
    );
  }

  if (!localRequestAllowed(request)) {
    return Response.json(
      {
        error: {
          code: "LOCAL_DEMO_DISABLED",
          message:
            "This status endpoint is loopback-only in local simulation mode.",
        },
      },
      { status: 404 },
    );
  }

  return Response.json({
    data: {
      mode: "local-simulation",
      provider: "LOCAL_SIMULATION",
      liveConfigured: false,
      loopbackOnly: true,
    },
  });
}
