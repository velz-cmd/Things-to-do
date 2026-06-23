import type { Proof } from "@/lib/deputy/ui-types";
import { Card } from "@/components/ui";

export function ProofArtifactPanel({ proofs }: { proofs: Proof[] }) {
  if (!proofs.length) {
    return (
      <Card>
        <p className="text-xs uppercase text-deputy-muted">Proof engine</p>
        <p className="mt-2 text-sm text-deputy-muted">Awaiting verifiable evidence</p>
      </Card>
    );
  }

  const latest = proofs[proofs.length - 1];
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(latest.payload);
  } catch {
    payload = {};
  }

  return (
    <Card>
      <p className="text-xs uppercase text-deputy-muted">Proof engine</p>
      <p
        className={`mt-1 text-sm font-semibold ${latest.verified ? "text-deputy-accent" : "text-deputy-warn"}`}
      >
        {latest.verified ? "VERIFIED" : "PENDING"} — {latest.type.replace(/_/g, " ")}
      </p>
      <p className="mt-1 font-mono text-xs text-deputy-muted break-all">
        {latest.contentHash.slice(0, 42)}…
      </p>
      {payload.confirmationId != null && (
        <p className="mt-2 text-xs text-deputy-muted">
          Confirmation: {String(payload.confirmationId)}
        </p>
      )}
      {latest.artifactUrl && (
        <a
          href={latest.artifactUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-xs text-deputy-accent underline"
        >
          View artifact
        </a>
      )}
    </Card>
  );
}
