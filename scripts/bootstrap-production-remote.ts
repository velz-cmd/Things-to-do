/**
 * Trigger production sensor bootstrap via cron secret.
 * Usage: CRON_SECRET=... npx tsx scripts/bootstrap-production-remote.ts
 */
const BASE = process.env.PRODUCTION_URL?.trim() || "https://resolve-self.vercel.app";
const SECRET = process.env.CRON_SECRET?.trim() || process.env.BOOTSTRAP_SENSOR_SECRET?.trim();

async function main() {
  if (!SECRET) {
    console.error("Set CRON_SECRET or BOOTSTRAP_SENSOR_SECRET");
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${SECRET}`,
    "Content-Type": "application/json",
  };

  console.log("Before:", await fetch(`${BASE}/api/health/live`).then((r) => r.json()));

  const bootstrap = await fetch(`${BASE}/api/cron/bootstrap-sensors`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const body = await bootstrap.json();
  console.log("Bootstrap:", bootstrap.status, JSON.stringify(body, null, 2).slice(0, 2000));

  const tick = await fetch(`${BASE}/api/cron/tick`, { method: "POST", headers });
  console.log("Tick:", tick.status, (await tick.text()).slice(0, 500));

  console.log("After:", await fetch(`${BASE}/api/health/live`).then((r) => r.json()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
