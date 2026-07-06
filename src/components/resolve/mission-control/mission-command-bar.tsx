"use client";

import clsx from "clsx";
import { Download, LineChart, Loader2, Shield, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import type { MissionBlueprintPanelHandle } from "@/components/resolve/mission-control/mission-blueprint-panel";

export function MissionCommandBar({
  handle,
  authorizing,
  className,
}: {
  handle: MissionBlueprintPanelHandle;
  authorizing?: boolean;
  className?: string;
}) {
  const { simulated, policyLabel } = handle.state;

  return (
    <div
      className={clsx(
        "mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border border-resolve-border/60 bg-[#0a0f18]/95 p-2.5 shadow-lg shadow-black/30 backdrop-blur-md",
        className,
      )}
      data-testid="mission-command-bar"
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => handle.simulate()}
      >
        <LineChart className="h-3.5 w-3.5" />
        Simulate
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => handle.cyclePolicy()}
        title="Cycle allocation policy"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Policy · {policyLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => handle.exportBlueprint()}
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>
      <Button
        type="button"
        size="sm"
        className="ml-auto gap-1.5"
        disabled={authorizing || !simulated}
        onClick={() => void handle.authorize()}
      >
        {authorizing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Shield className="h-3.5 w-3.5" />
        )}
        Authorize
      </Button>
    </div>
  );
}
