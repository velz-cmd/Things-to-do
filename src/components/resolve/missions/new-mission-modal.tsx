"use client";

import { useRouter } from "next/navigation";
import { X, Target, Users, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useMissionModal } from "@/components/resolve/missions/mission-modal-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";
import clsx from "clsx";

const MISSION_TYPES = [
  {
    id: "bounty",
    title: "Bounty",
    description: "Release USDC when work is verified — PR merged, deliverable approved.",
    icon: Target,
    templates: ["bounty-designer-200", "bounty-pr-merge", "bounty-researcher-500"],
  },
  {
    id: "distribution",
    title: "Distribution",
    description: "Batch pay open-source creators after verified events.",
    icon: Users,
    href: "/distribute",
  },
  {
    id: "recovery",
    title: "Recovery",
    description: "Outcome-based refund or cancellation with proof gate.",
    icon: RotateCcw,
    templates: ["airline-refund-43", "subscription-cancel"],
  },
] as const;

export function NewMissionModal() {
  const router = useRouter();
  const { open, closeModal } = useMissionModal();
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();

  if (!open) return null;

  async function createFromTemplate(templateId: string) {
    if (!ready) {
      openSignIn();
      return;
    }
    closeModal();
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/missions?mission=${data.task.id}`);
      toast.success("Mission created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create mission");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={closeModal}
      />
      <div className="relative w-full max-w-lg animate-resolve-enter rounded-lg border border-resolve-border-strong bg-resolve-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-resolve-border px-5 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
              New mission
            </p>
            <h2 className="text-lg font-semibold text-white">Choose mission type</h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md p-1.5 text-resolve-muted hover:bg-resolve-hover hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {MISSION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.id}
                className="rounded-lg border border-resolve-border-strong bg-resolve-bg p-4"
              >
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-resolve-border-strong bg-resolve-hover">
                    <Icon className="h-4 w-4 text-resolve-accent" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{type.title}</p>
                    <p className="mt-0.5 text-xs text-resolve-muted">{type.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {"href" in type ? (
                        <button
                          type="button"
                          onClick={() => {
                            closeModal();
                            router.push(type.href);
                          }}
                          className={btnClass}
                        >
                          Open distribute
                        </button>
                      ) : (
                        "templates" in type &&
                        type.templates.map((tid) => {
                          const t = DEMO_OUTCOMES.find((o) => o.id === tid);
                          if (!t) return null;
                          return (
                            <button
                              key={tid}
                              type="button"
                              onClick={() => void createFromTemplate(tid)}
                              className={btnClass}
                            >
                              {t.title}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btnClass = clsx(
  "rounded-md border border-resolve-border-strong bg-resolve-hover px-2.5 py-1.5 text-left text-[11px] font-medium text-white transition hover:border-resolve-accent/40 hover:bg-resolve-accent-muted"
);
