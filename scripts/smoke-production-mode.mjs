import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR ?? ".next";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startForMode(mode) {
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      RESEARCHVAULT_MODE: mode,
      NEXT_DIST_DIR: distDir,
      NEXT_TELEMETRY_DISABLED: "1",
      // Make the intended missing-adapter case hermetic even if a developer
      // has a real adapter in their shell or data/tidecloak.json.
      ...(mode === "live" ? { CLIENT_ADAPTER: "{}" } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  const url = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`next start exited (${child.exitCode}):\n${logs.join("")}`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
        if (response.status < 500) return { child, logs, html: await response.text() };
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`next start did not serve /:\n${logs.join("")}`);
  } catch (error) {
    await stop(child);
    throw error;
  }
}

async function stop(child) {
  if (child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
}

const live = await startForMode("live");
try {
  assert.match(live.html, /Live access is not ready yet\./);
  assert.match(live.html, /Local simulation disabled/);
  assert.doesNotMatch(live.html, /Choose a demo persona|Maya Chen/);
  console.log("PASS: production live mode without an adapter renders the closed setup screen, not demo personas.");
} finally {
  await stop(live.child);
}

const local = await startForMode("local-simulation");
try {
  assert.match(local.html, /functional local simulation/i);
  assert.match(local.html, /Choose a demo persona/);
  assert.match(local.html, /Maya Chen/);
  assert.doesNotMatch(local.html, /Live access is not ready yet\./);
  console.log("PASS: the same production build renders local personas only when started in local-simulation mode.");
} finally {
  await stop(local.child);
}
