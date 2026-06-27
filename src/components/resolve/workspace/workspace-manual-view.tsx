"use client";

import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import type { OsQuestionAnswer, OsQuestionId } from "@/lib/workspace/economic-os";

const QUESTION_ORDER: OsQuestionId[] = [
  "value_happening",
  "value_leaking",
  "who_created",
  "unpaid",
  "who_funds",
  "what_next",
];

/** Manual interface — same engine as chat, structured by six questions. */
export function WorkspaceManualView({ answers }: { answers: OsQuestionAnswer[] }) {
  const byId = new Map(answers.map((a) => [a.id, a]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {QUESTION_ORDER.map((id) => {
        const a = byId.get(id);
        if (!a) return null;

        return (
          <BlueGlowCard
            key={id}
            className={clsx("p-5", a.empty && "opacity-80")}
            grid={!a.empty}
            hover={!a.empty}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-accent">
              {a.question}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-white">{a.summary}</p>
            {a.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {a.bullets.map((b) => (
                  <li key={b} className="text-xs leading-relaxed text-resolve-muted">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {id === "what_next" && !a.empty && (
              <Link
                href="/payments"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-resolve-accent-bright hover:underline"
              >
                Execute capital movement
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
            {id === "value_happening" && (
              <Link
                href="/activity"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-resolve-muted hover:text-white"
              >
                View sensor feed
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </BlueGlowCard>
        );
      })}
    </div>
  );
}
