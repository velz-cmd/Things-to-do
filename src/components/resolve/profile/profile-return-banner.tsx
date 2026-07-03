"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Return banner when Profile opened with ?next= from Communities connect flow. */
export function ProfileReturnBanner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  if (!next || !next.startsWith("/")) return null;

  let label = "Return";
  if (next.startsWith("/communities/")) {
    const slug = next.split("/")[2]?.split("?")[0];
    label = slug ? `Return to ${slug.replace(/-/g, " ")}` : "Return to community";
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-resolve-accent/25 bg-resolve-accent/5 px-4 py-3">
      <p className="text-sm text-white">
        Connect sources here — activity syncs to your community console when you return.
      </p>
      <Link
        href={next}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/10"
      >
        <ArrowLeft className="h-3 w-3" />
        {label}
      </Link>
    </div>
  );
}
