import { sendClaimEmail } from "../src/lib/deputy/tools/resend";
import { generateDeputyPlan } from "../src/lib/ai/planner";
import { listConfiguredProviders } from "../src/lib/ai/gateway";
import { generateTextWithFallback } from "../src/lib/ai/gateway";

async function main() {
  console.log("AI providers:", JSON.stringify(listConfiguredProviders(), null, 2));

  console.log("\nTesting fast tier...");
  try {
    const fast = await generateTextWithFallback({
      tier: "fast",
      prompt: "Reply with one word: OK",
    });
    console.log("Fast:", fast.text.trim(), "via", fast.meta.modelId);
  } catch (e) {
    console.log("Fast tier skipped:", e instanceof Error ? e.message : e);
  }

  console.log("\nTesting Resend...");
  const email = await sendClaimEmail({
    to: "test@test.com",
    subject: "RESOLVE claim test",
    body: "Test claim from RESOLVE outcome engine.",
    taskId: "integration-test",
  });
  console.log("Resend OK:", email?.id);

  console.log("\nTesting quality planner...");
  const plan = await generateDeputyPlan({
    title: "Founder distribution",
    description: "Distribute $500 to community contributors after verified plays",
    targetValueUsd: 500,
    category: "distribution",
  });
  console.log("Plan:", JSON.stringify(plan, null, 2));
}

main().catch(console.error);
