import { sendClaimEmail } from "../src/lib/deputy/tools/resend";
import { generateDeputyPlan } from "../src/lib/ai/planner";
import {
  completeQwenChat,
  isQwenConfigured,
  QWEN_MODELS,
} from "../src/lib/ai/qwen";

async function main() {
  console.log("Testing Resend...");
  const email = await sendClaimEmail({
    to: "test@test.com",
    subject: "RESOLVE claim test",
    body: "Test claim from RESOLVE outcome engine.",
    taskId: "integration-test",
  });
  console.log("Resend OK:", email?.id);

  console.log("\nTesting Qwen...");
  if (!isQwenConfigured()) {
    console.log("DASHSCOPE_API_KEY not set — skipping Qwen live test");
  } else {
    const reply = await completeQwenChat({
      model: QWEN_MODELS.flash,
      enableThinking: true,
      messages: [{ role: "user", content: "Who are you? Reply in one sentence." }],
    });
    console.log("Qwen reasoning:", reply.reasoning.slice(0, 120) || "(none)");
    console.log("Qwen content:", reply.content);
  }

  console.log("\nTesting mission planner...");
  const plan = await generateDeputyPlan({
    title: "Founder distribution",
    description: "Distribute $500 to community contributors after verified plays",
    targetValueUsd: 500,
    category: "distribution",
  });
  console.log("Plan:", JSON.stringify(plan, null, 2));
}

main().catch(console.error);
