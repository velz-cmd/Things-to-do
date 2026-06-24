import { Suspense } from "react";
import { MissionHub } from "@/components/resolve/missions/mission-hub";
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
      <MissionHub />
    </Suspense>
  );
}
