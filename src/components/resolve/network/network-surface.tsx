"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** @deprecated — use Discover live feed + global value graph */
export function NetworkSurface() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/discover");
  }, [router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-resolve-muted">Redirecting to Discover…</p>
      <Link href="/discover" className="mt-2 inline-block text-resolve-accent hover:underline">
        Open Discover →
      </Link>
    </div>
  );
}
