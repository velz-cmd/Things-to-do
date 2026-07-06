"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ListOrdered, X } from "lucide-react";
import {
  loadMissionQueue,
  removeMissionQueueItem,
  type MissionQueueItem,
} from "@/lib/mission/mission-agent-budget";

export function MissionQueueStrip({
  onSelect,
  className,
}: {
  onSelect?: (item: MissionQueueItem) => void;
  className?: string;
}) {
  const [queue, setQueue] = useState<MissionQueueItem[]>([]);

  useEffect(() => {
    setQueue(loadMissionQueue());
  }, []);

  if (!queue.length) return null;

  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.08] bg-[#0a0f18]/80 px-3 py-2",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        <ListOrdered className="h-3 w-3" />
        Mission queue · {queue.length}/3
      </p>
      <ul className="mt-2 space-y-1">
        {queue.map((item) => (
          <li key={item.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect?.(item)}
              className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-left text-[11px] text-resolve-muted hover:bg-white/[0.04] hover:text-white"
            >
              {item.objective}
            </button>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => setQueue(removeMissionQueueItem(item.id))}
              className="rounded p-1 text-resolve-muted-dim hover:text-rose-300"
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
