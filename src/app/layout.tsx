import type { Metadata } from "next";
import "./styles.css";
import { publicTideConfig } from "@/lib/auth/publicConfig";
import type { TidecloakConfig } from "@tidecloak/nextjs/server";
import { Providers } from "./providers";
import { LiveUnavailable } from "./live-unavailable";

// Runtime mode can change between `next build` and `next start`; never freeze
// the local persona surface into a production build configured for another mode.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ResearchVault · Local demo",
  description:
    "A local ResearchVault governance and access demo using synthetic research data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const live =
    (process.env.RESEARCHVAULT_MODE ?? "local-simulation") === "live";

  if (!live) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  let config: TidecloakConfig;
  try {
    config = publicTideConfig();
    if (
      !config.realm ||
      !config.resource ||
      !config["auth-server-url"] ||
      !config.jwk?.keys?.length
    ) {
      throw new Error("missing IGA keys");
    }
  } catch {
    return (
      <html lang="en">
        <body>
          <LiveUnavailable detail="Missing or incomplete IGA realm adapter" />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <Providers config={config}>{children}</Providers>
      </body>
    </html>
  );
}
