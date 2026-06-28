"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";

type EarningsPeek = {
  signedIn: boolean;
  claimableUsd: number;
};

export function HomePrimaryCta() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<EarningsPeek | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/earnings", { credentials: "include" })
      .then((r) => r.json())
      .then((body: EarningsPeek) => {
        if (!cancelled) setEarnings(body);
      })
      .catch(() => {
        if (!cancelled) setEarnings({ signedIn: false, claimableUsd: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const claimFirst = (earnings?.signedIn ?? false) && (earnings?.claimableUsd ?? 0) > 0;

  if (claimFirst) {
    return (
      <Button variant="glow" size="lg" onClick={() => router.push("/claim")}>
        Claim <Money amount={earnings!.claimableUsd} size="sm" className="inline" />
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button variant="glow" size="lg" onClick={() => router.push("/mission")}>
      Open Mission
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
