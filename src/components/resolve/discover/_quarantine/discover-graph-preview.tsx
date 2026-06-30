"use client";

import { ValueGraph } from "@/components/resolve/discover/value-graph";

/** @deprecated Use ValueGraph — kept for import stability */
export function DiscoverGraphPreview({ className }: { className?: string }) {
  return <ValueGraph variant="full" className={className} />;
}
