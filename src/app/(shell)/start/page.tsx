import { Suspense } from "react";
import CommandContent from "../command-content";

export default function StartPage() {
  return (
    <Suspense fallback={<div className="p-8 text-resolve-muted">Loading…</div>}>
      <CommandContent />
    </Suspense>
  );
}
