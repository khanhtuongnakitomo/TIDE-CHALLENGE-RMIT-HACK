import { execSync, spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const feDir = resolve(root, "FE");

/** Free a local TCP port if a previous dev server process is still holding it. */
function freePortIfInUse(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      const pids = [
        ...new Set(
          out
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter((s) => /^\d+$/.test(s) && Number(s) !== process.pid),
        ),
      ];
      for (const pid of pids) {
        console.log(`  • Stopping previous process on port ${port} (PID ${pid})…`);
        spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
    }
  } catch {
    // Port is already free
  }
}

console.log("==============================================================");
console.log(" ResearchVault — Full-Stack Development Server");
console.log("  • Backend API & Next.js : http://127.0.0.1:3100");
console.log("  • Frontend (Caldera UI) : http://127.0.0.1:5173");
console.log("==============================================================");

freePortIfInUse(3100);
freePortIfInUse(5173);

try {
  rmSync(join(root, ".next", "dev", "lock"), { force: true });
} catch {
  // Ignore if no lock file exists
}

const backend = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);

const frontend = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173"],
  {
    cwd: feDir,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_BACKEND_ORIGIN: "http://127.0.0.1:3100",
    },
  },
);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [frontend, backend]) {
    if (child.exitCode === null && child.pid) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        child.kill("SIGTERM");
      }
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
backend.on("exit", (code) => shutdown(code ?? 0));
frontend.on("exit", (code) => shutdown(code ?? 0));
