/**
 * Circle Entity Secret — register, verify, or diagnose.
 *
 * Prerequisites: CIRCLE_API_KEY in env (full TEST_API_KEY:uuid:secret string).
 *
 * Usage:
 *   npx tsx scripts/register-circle-entity-secret.ts verify
 *   npx tsx scripts/register-circle-entity-secret.ts register
 *   npx tsx scripts/register-circle-entity-secret.ts register --write-env
 *
 * register — first-time only (Circle returns 156015 if already registered).
 * verify   — checks CIRCLE_ENTITY_SECRET / DB cache against Circle.
 *
 * If you already registered (Console shows a date) but lost the hex:
 *   1. Cancel Console "Rotate" (needs current ciphertext).
 *   2. Use Console "Reset" with recovery_file_*.dat from registration, OR
 *   3. Copy CIRCLE_ENTITY_SECRET from Vercel / production DB appConfig, OR
 *   4. Create a new Circle API key and run register on a fresh entity.
 *
 * See docs/CIRCLE-SETUP.md
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getCircleEntitySecret,
  normalizeCircleEntitySecret,
} from "../src/lib/wallet/circle-config";
import { circleErrorMessage } from "../src/lib/wallet/circle-errors";

type Command = "verify" | "register";

function parseArgs(): { command: Command; writeEnv: boolean } {
  const args = process.argv.slice(2);
  const command = (args.find((a) => a === "verify" || a === "register") ??
    "verify") as Command;
  const writeEnv = args.includes("--write-env");
  return { command, writeEnv };
}

function maskSecret(secret: string): string {
  if (secret.length < 12) return "***";
  return `${secret.slice(0, 6)}…${secret.slice(-6)}`;
}

async function verifyExisting(): Promise<void> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set CIRCLE_API_KEY (TEST_API_KEY:uuid:secret from Circle Console).");
  }

  const fromEnv = normalizeCircleEntitySecret(process.env.CIRCLE_ENTITY_SECRET);
  const stored = await getCircleEntitySecret();
  const candidate = fromEnv ?? stored;

  if (!candidate) {
    console.log("No CIRCLE_ENTITY_SECRET in env and none cached in DB (appConfig.circle_entity_secret).");
    console.log("If Console shows Entity Secret registered, check Vercel env or run register on a NEW API key.");
    process.exit(1);
  }

  const { registerEntitySecretCiphertext } = await import(
    "@circle-fin/developer-controlled-wallets"
  );

  try {
    await registerEntitySecretCiphertext({ apiKey, entitySecret: candidate });
    console.log("Entity secret is valid for this Circle API key.");
    console.log(`Fingerprint: ${maskSecret(candidate)}`);
    console.log("\nAdd to Vercel → Settings → Environment Variables → Production:");
    console.log(`CIRCLE_ENTITY_SECRET=${candidate}`);
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 156015) {
      console.log("Entity secret is valid for this Circle API key (already registered).");
      console.log(`Fingerprint: ${maskSecret(candidate)}`);
      console.log(`\nCIRCLE_ENTITY_SECRET=${candidate}`);
      return;
    }
    console.error("Entity secret does NOT match Circle:", circleErrorMessage(err));
    console.error("\nNext steps:");
    console.error("  • Circle Console → Configurator → Entity Secret → Reset (upload recovery_file_*.dat)");
    console.error("  • Or create a new API key and run: npx tsx scripts/register-circle-entity-secret.ts register");
    process.exit(1);
  }
}

async function registerFirstTime(writeEnv: boolean): Promise<void> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set CIRCLE_API_KEY before registering.");
  }

  const existingEnv = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  if (writeEnv && /^CIRCLE_ENTITY_SECRET=/m.test(existingEnv)) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET already in .env — remove it first or run verify instead of register --write-env."
    );
  }

  const { registerEntitySecretCiphertext } = await import(
    "@circle-fin/developer-controlled-wallets"
  );

  const entitySecret = randomBytes(32).toString("hex");
  const recoveryDir = join(process.cwd(), "recovery");
  mkdirSync(recoveryDir, { recursive: true });

  try {
    const response = await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      recoveryFileDownloadPath: recoveryDir,
    });

    const recoveryFile = response.data?.recoveryFile;
    if (recoveryFile) {
      const recoveryPath = join(recoveryDir, `recovery_file_${Date.now()}.dat`);
      const { writeFileSync } = await import("node:fs");
      writeFileSync(recoveryPath, recoveryFile);
      console.log(`Recovery file saved: ${recoveryPath}`);
      console.log("Store this file separately from the entity secret (password manager / offline backup).");
    }
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 156015) {
      console.error(
        "Circle already has an entity secret for this API key (registered in Console)."
      );
      console.error("You cannot register again without Reset (recovery file) or Rotate (current secret).");
      console.error("Run: npx tsx scripts/register-circle-entity-secret.ts verify");
      console.error("See docs/CIRCLE-SETUP.md → Lost entity secret");
      process.exit(1);
    }
    throw err;
  }

  const { setCircleEntitySecret: persistSecret } = await import("../src/lib/wallet/circle-config");
  await persistSecret(entitySecret);

  console.log("\n=== COPY THESE NOW (Circle will not show the secret again) ===\n");
  console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
  console.log("\nPaste into Vercel → Settings → Environment Variables → Production, then redeploy.");

  if (writeEnv) {
    appendFileSync(".env", `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);
    console.log("Also appended CIRCLE_ENTITY_SECRET to .env for local dev.");
  }
}

async function main(): Promise<void> {
  const { command, writeEnv } = parseArgs();

  if (command === "verify") {
    await verifyExisting();
    return;
  }

  await registerFirstTime(writeEnv);
}

main().catch((err) => {
  console.error(circleErrorMessage(err));
  process.exit(1);
});
