import { Suspense } from "react";
import { MissionsWorkspace } from "@/components/resolve/missions/missions-workspace";
import { TableSkeleton } from "@/components/resolve/ui/skeleton";

export default function MissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <TableSkeleton rows={4} />
        </div>
      }
    >
      <MissionsWorkspace />
    </Suspense>
  );
}
