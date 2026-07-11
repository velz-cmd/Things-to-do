"use client";

import clsx from "clsx";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  MISSION_HERO_EYEBROW,
  MISSION_HERO_SUBTITLE,
  MISSION_HERO_TITLE,
  MISSION_PRIMARY_INTENTS,
} from "@/lib/mission/mission-lane-copy";
import { MissionPipelineStepper } from "@/components/resolve/mission-control/mission-pipeline-stepper";
import { CapitalCompilerVisual } from "@/components/resolve/visuals/capital-compiler";

export function MissionCommandHero({
  onSubmit,
  className,
}: {
  onSubmit: (prompt: string) => void;
  className?: string;
}) {
  return (
    <header className={clsx("mission-on-canvas", className)}>
      <div className="mission-hero-panel">
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,.9fr)_minmax(420px,1.1fr)]">
          <div className="min-w-0">
            <p className="mission-eyebrow">
              <Sparkles className="inline h-3.5 w-3.5 text-violet-300" aria-hidden />
              {MISSION_HERO_EYEBROW}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
              {MISSION_HERO_TITLE}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-resolve-muted">
              {MISSION_HERO_SUBTITLE}
            </p>
            <MissionPipelineStepper activeStep="signal" className="mt-5" />
          </div>
          <CapitalCompilerVisual />
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3" role="list" aria-label="Start a mission">
          {MISSION_PRIMARY_INTENTS.map((intent) => {
            const Icon = intent.icon;
            return (
              <button
                key={intent.id}
                type="button"
                role="listitem"
                onClick={() => onSubmit(intent.prompt)}
                className={clsx("mission-intent-card group", `mission-intent-card--${intent.tone}`)}
              >
                <span className="mission-intent-card__icon">
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-white">{intent.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-resolve-muted">
                    {intent.detail}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
