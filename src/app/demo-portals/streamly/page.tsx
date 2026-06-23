"use client";

import { Suspense } from "react";
import { StreamlyPortal } from "./portal";

export default function StreamlyDemoPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0c1018] text-slate-400">
          Loading Streamly demo portal…
        </div>
      }
    >
      <StreamlyPortal />
    </Suspense>
  );
}
