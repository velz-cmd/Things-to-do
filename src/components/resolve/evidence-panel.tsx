import type { Proof, Task } from "@/lib/deputy/ui-types";

export function EvidencePanel({
  proofs,
  task,
}: {
  proofs: Proof[];
  task: Task;
}) {
  const items: { label: string; value: string; href?: string }[] = [];

  for (const p of proofs) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(p.payload);
    } catch {
      /* ignore */
    }
    items.push({
      label: p.type.replace(/_/g, " "),
      value: String(payload.confirmationId ?? p.contentHash.slice(0, 16) + "…"),
      href: p.artifactUrl ?? undefined,
    });
  }

  for (const e of task.events) {
    const lower = e.message.toLowerCase();
    if (
      lower.includes("email") ||
      lower.includes("ticket") ||
      lower.includes("booking") ||
      lower.includes("receipt") ||
      lower.includes("submitted")
    ) {
      items.push({
        label: e.agent,
        value: e.message.length > 48 ? e.message.slice(0, 48) + "…" : e.message,
      });
    }
  }

  for (const mp of task.microPayments ?? []) {
    items.push({
      label: mp.purpose,
      value: `$${mp.amountUsd.toFixed(3)}`,
      href: mp.txHash
        ? `https://testnet.arcscan.app/tx/${mp.txHash}`
        : undefined,
    });
  }

  if (task.escrowTxHash) {
    items.push({
      label: "Escrow lock",
      value: task.escrowTxHash.slice(0, 18) + "…",
      href: `https://testnet.arcscan.app/tx/${task.escrowTxHash}`,
    });
  }

  if (task.settlementTxHash) {
    items.push({
      label: "Settlement transaction",
      value: task.settlementTxHash.slice(0, 18) + "…",
      href: `https://testnet.arcscan.app/tx/${task.settlementTxHash}`,
    });
  }

  if (task.proofHash) {
    items.push({
      label: "Proof hash",
      value: task.proofHash.slice(0, 18) + "…",
    });
  }

  const placeholders = [
    "Email confirmations",
    "PDF receipts",
    "Transaction hashes",
    "Support tickets",
    "Screenshots",
  ];

  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Evidence
      </h2>
      {items.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {placeholders.map((p) => (
            <span
              key={p}
              className="rounded-full border border-dashed border-deputy-border px-3 py-1 text-xs text-deputy-muted"
            >
              {p}
            </span>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between rounded-lg bg-deputy-bg/60 px-3 py-2 text-sm"
            >
              <span className="text-deputy-muted">{item.label}</span>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-deputy-accent underline"
                >
                  {item.value}
                </a>
              ) : (
                <span className="font-mono text-xs">{item.value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
