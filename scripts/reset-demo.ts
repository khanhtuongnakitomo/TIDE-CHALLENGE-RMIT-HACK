if (process.env.RESEARCHVAULT_MODE !== "local-simulation") {
  throw new Error("Demo reset is allowed only when RESEARCHVAULT_MODE=local-simulation is explicitly set.");
}
const { resetDemo } = await import("../src/lib/db.ts");
resetDemo();
console.log("Local synthetic demo state reset.");
export {};
