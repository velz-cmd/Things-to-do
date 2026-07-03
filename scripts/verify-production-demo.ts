/**
 * Verify production demo readiness against a live deployment.
 *
 * Usage:
 *   APP_URL=https://things-to-do-eta.vercel.app CRON_SECRET=... npx tsx scripts/verify-production-demo.ts
 */
const base =
  process.env.APP_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://things-to-do-eta.vercel.app";

const cron = process.env.CRON_SECRET?.trim() || process.env.CLAIM_TOKEN_SECRET?.trim();

type Json = Record<string, unknown>;

async function get(path: string): Promise<{ ok: boolean; status: number; data: Json }> {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20_000) });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

async function post(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Json }> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cron ? { Authorization: `Bearer ${cron}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

function printSection(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

async function main() {
  console.log(`RESOLVE production demo verify → ${base}`);

  printSection("Demo readiness");
  const readiness = await get("/api/status/demo-readiness");
  if (!readiness.ok) {
    console.error("FAIL", readiness.status, readiness.data);
    process.exit(1);
  }
  const items = readiness.data.items as Array<{ label: string; status: string; detail: string }>;
  for (const item of items ?? []) {
    const icon = item.status === "ready" ? "✓" : item.status === "partial" ? "~" : "✗";
    console.log(`  ${icon} ${item.label}: ${item.detail}`);
  }
  console.log(`  Score: ${readiness.data.score}/${readiness.data.total}`);

  printSection("Production status");
  const prod = await get("/api/status/production");
  console.log(prod.ok ? "  OK" : `  HTTP ${prod.status}`, prod.data.issues ?? []);

  printSection("Arc treasury");
  const arc = await get("/api/treasury/arc-readiness");
  console.log(
    `  canDistribute: ${arc.data.canDistributeOnChain} · balance: $${arc.data.balanceUsd ?? 0}`,
  );

  if (cron) {
    printSection("Bootstrap sensors (operator)");
    const boot = await post("/api/cron/bootstrap-sensors");
    console.log(boot.ok ? "  OK" : `  HTTP ${boot.status}`, JSON.stringify(boot.data, null, 2));

    printSection("Seed production artist registry");
    const seed = await post("/api/registry/seed-production");
    console.log(seed.ok ? "  OK" : `  HTTP ${seed.status}`, seed.data);
  } else {
    console.log("\n  (skip bootstrap/seed — set CRON_SECRET to run operator steps)");
  }

  const blocked = (items ?? []).filter((i) => i.status === "blocked");
  if (blocked.length) {
    console.log(`\n✗ ${blocked.length} blocked item(s) — fix before external demo`);
    process.exit(1);
  }
  console.log("\n✓ Demo readiness looks good");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
