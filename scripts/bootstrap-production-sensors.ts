/**
 * Local production bootstrap — requires DATABASE_URL, GITHUB_TOKEN, OPENALEX_API_KEY.
 * Usage: DATABASE_URL=... GITHUB_TOKEN=... OPENALEX_API_KEY=... npx tsx scripts/bootstrap-production-sensors.ts
 */
import { bootstrapProductionSensors } from "../src/lib/sensors/bootstrap";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.error("GITHUB_TOKEN required");
    process.exit(1);
  }

  const userId = process.env.BOOTSTRAP_USER_ID?.trim();
  console.log("Bootstrapping production sensors…");
  const result = await bootstrapProductionSensors(userId ? { userId } : undefined);

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
  console.log("\nBootstrap complete — gated communities should appear when sensorLive is true");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
