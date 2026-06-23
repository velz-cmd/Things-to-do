import { NextResponse } from "next/server";

/// Demo claim artifact — referenced by browser.submitClaim when Playwright is off
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId") ?? "unknown";
  const ticket = searchParams.get("ticket") ?? "unknown";

  const payload = {
    type: "claim_submission",
    taskId,
    ticketId: ticket,
    portal: "SkyDemo Airlines Support",
    status: "submitted",
    generatedAt: new Date().toISOString(),
    message: "Autonomous claim submitted via RESOLVE browser agent (demo artifact).",
  };

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#0a0f14;color:#e8edf2">
        <h1 style="color:#3dd68c">Claim submitted</h1>
        <p>Ticket: <code>${ticket}</code></p>
        <p>Task: <code>${taskId}</code></p>
        <p style="color:#8b9aab">RESOLVE — pay only on proof</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return NextResponse.json(payload);
}
