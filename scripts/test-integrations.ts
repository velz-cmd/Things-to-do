import { sendClaimEmail } from "../src/lib/deputy/tools/resend";
import { generateDeputyPlan } from "../src/lib/ai/planner";

async function main() {
  console.log("Testing Resend...");
  const email = await sendClaimEmail({
    to: "test@test.com",
    subject: "DEPUTY claim test",
    body: "Test claim from DEPUTY outcome engine.",
    taskId: "integration-test",
  });
  console.log("Resend OK:", email?.id);

  console.log("\nTesting Gemini planner...");
  const plan = await generateDeputyPlan({
    title: "Airline refund",
    description: "Recover $43 from SkyDemo Airlines",
    targetValueUsd: 43,
    category: "money_recovery",
  });
  console.log("Plan:", JSON.stringify(plan, null, 2));
}

main().catch(console.error);
