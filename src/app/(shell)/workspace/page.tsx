import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceCommand } from "@/components/resolve/workspace/workspace-command";

export const metadata: Metadata = {
  title: "Workspace — RESOLVE",
  description: "AI-native command center for value recognition and capital flow.",
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading workspace…</p>}>
      <WorkspaceCommand />
    </Suspense>
  );
}
