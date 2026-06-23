import type { MicroPayment } from "@/lib/deputy/ui-types";
import { Card } from "@/components/ui";

export function MicroPaymentLog({ payments }: { payments: MicroPayment[] }) {
  if (!payments?.length) return null;

  return (
    <Card>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Agent micro-payments
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-deputy-muted">
        {payments.map((p) => (
          <li key={p.id} className="flex justify-between gap-2">
            <span className="truncate">{p.purpose}</span>
            <span className="text-deputy-warn">${p.amountUsd.toFixed(4)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
