import path from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

// pnpm stores peer-qualified packages in .pnpm. Resolve the pinned official
// React SDK directly because its root Windows symlink can omit that peer suffix.
const tideReactVersion = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")).dependencies["@tidecloak/react"] as string;
const pnpmStore = path.resolve(process.cwd(), "node_modules/.pnpm");
const tideReactFolder = readdirSync(pnpmStore).find((name) => name.startsWith(`@tidecloak+react@${tideReactVersion}_`));
if (!tideReactFolder) throw new Error(`Cannot find pinned @tidecloak/react@${tideReactVersion} in pnpm store`);
const tideReactEntry = path.resolve(pnpmStore, tideReactFolder, "node_modules/@tidecloak/react/dist/esm/index.js");
if (!existsSync(tideReactEntry)) throw new Error(`Official Tide React entry is missing: ${tideReactEntry}`);

const nextConfig: NextConfig = {
  agentRules: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  webpack: (config) => {
    config.module.strictExportPresence = false;
    config.resolve.alias = {
      ...config.resolve.alias,
      "@tidecloak/react$": tideReactEntry,
    };
    return config;
  },
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-src 'self' *" }] },
      { source: "/tide_dpop/:path*", headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'unsafe-inline'" },
        { key: "Allow-CSP-From", value: "*" },
      ] },
    ];
  },
  async rewrites() { return [{ source: "/tide_dpop/:path*", destination: "/tide_dpop_auth.html" }]; },
};
export default nextConfig;
