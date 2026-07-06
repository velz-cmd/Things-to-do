/**
 * Circle Entity Secret — register, verify, or diagnose.
 *
 * See docs/CIRCLE-SETUP.md
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeCircleEntitySecret } from "../src/lib/wallet/circle-secret";
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

  const candidate = normalizeCircleEntitySecret(process.env.CIRCLE_ENTITY_SECRET);
  if (!candidate) {
    console.log("Set CIRCLE_ENTITY_SECRET (64 hex chars, colon ok) and retry.");
    process.exit(1);
  }

  const { registerEntitySecretCiphertext } = await import(
    "@circle-fin/developer-controlled-wallets"
  );

  try {
    await registerEntitySecretCiphertext({ apiKey, entitySecret: candidate });
    console.log("Entity secret is valid for this Circle API key.");
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 156015) {
      console.error("Entity secret does NOT match Circle:", circleErrorMessage(err));
      process.exit(1);
    }
    console.log("Entity secret is valid (already registered with Circle).");
  }

  console.log(`Fingerprint: ${maskSecret(candidate)}`);
  console.log(`\nCIRCLE_ENTITY_SECRET=${candidate}`);
}

async function registerFirstTime(writeEnv: boolean): Promise<void> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set CIRCLE_API_KEY before registering.");
  }

  const existingEnv = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  if (writeEnv && /^CIRCLE_ENTITY_SECRET=/m.test(existingEnv)) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET already in .env — remove it first or run verify instead.",
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
      writeFileSync(join(recoveryDir, `recovery_file_${Date.now()}.dat`), recoveryFile);
      console.log(`Recovery file saved under ${recoveryDir}/`);
    }
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 156015) {
      console.error("Circle already has an entity secret for this API key.");
      console.error("Run: npx tsx scripts/register-circle-entity-secret.ts verify");
      console.error("See docs/CIRCLE-SETUP.md → Lost entity secret");
      process.exit(1);
    }
    throw err;
  }

  console.log("\n=== COPY THESE NOW (Circle will not show the secret again) ===\n");
  console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
  console.log("\nPaste into Vercel → All Environments, then redeploy.");

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
