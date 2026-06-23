"use client";

import { useEffect, useState } from "react";

export function VerifiedTxLink({
  hash,
  className,
  truncate = false,
}: {
  hash: string;
  className?: string;
  truncate?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "verified" | "pending">(
    "loading"
  );

  useEffect(() => {
    fetch(`/api/settlement/verify-tx/${hash}`)
      .then((r) => r.json())
      .then((d) => {
        setStatus(
          d.verification?.found && d.verification?.success
            ? "verified"
            : "pending"
        );
      })
      .catch(() => setStatus("pending"));
  }, [hash]);

  const display =
    truncate && hash.length > 18 ? `${hash.slice(0, 18)}…` : hash;

  if (status === "loading") {
    return (
      <p className={className ?? "text-xs text-deputy-muted"}>
        Verifying on Arc…
      </p>
    );
  }

  if (status === "verified") {
    return (
      <a
        href={`https://testnet.arcscan.app/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className={
          className ??
          "font-mono text-xs text-deputy-accent underline"
        }
      >
        {display}
      </a>
    );
  }

  return (
    <p className={className ?? "text-xs text-deputy-warn"}>
      Pending / not indexed on Arc — no explorer link
    </p>
  );
}
