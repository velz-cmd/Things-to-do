"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  Landmark,
  Network,
} from "lucide-react";
import clsx from "clsx";
import styles from "./homepage.module.css";

const STAGES = [
  { label: "Observe", text: "Sources detect activity where work already happens.", icon: Eye },
  { label: "Verify", text: "RESOLVE links proof to the people and communities behind it.", icon: FileCheck2 },
  { label: "Blueprint", text: "Mission compiles the evidence into a decision-ready payout plan.", icon: Network },
  { label: "Fund", text: "Operators or communities review the requirement and authorize capital.", icon: Landmark },
  { label: "Settle", text: "Arc moves USDC and produces a receipt the recipient can verify.", icon: CircleDollarSign },
] as const;

const MOBILE_STAGE_DETAILS = [
  ["Source event detected", "Activity enters the evidence queue"],
  ["Proof attached", "Identity and contributors resolved"],
  ["Payees and policy compiled", "Funding requirement prepared"],
  ["Capital path reviewed", "Authorization ready"],
  ["USDC routed on Arc", "Example receipt confirmed"],
] as const;

const BLUEPRINT_ROWS = ["Payee plan", "Allocation policy", "Funding requirement", "Settlement path"] as const;

type WorkflowState = {
  activeStage: number;
  stageProgress: number;
  overallProgress: number;
};

const INITIAL_STATE: WorkflowState = { activeStage: -1, stageProgress: 0, overallProgress: 0 };

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function roundProgress(value: number) {
  return Math.round(value * 1000) / 1000;
}

function useWorkflowScrollProgress() {
  const storyRef = useRef<HTMLDivElement | null>(null);
  const stageRefs = useRef<Array<HTMLElement | null>>([]);
  const [workflowState, setWorkflowState] = useState<WorkflowState>(INITIAL_STATE);

  useEffect(() => {
    const nodes = stageRefs.current.filter((node): node is HTMLElement => Boolean(node));
    const story = storyRef.current;
    if (!story || nodes.length === 0) return;

    const visibleStages = new Set<number>();
    let frame = 0;

    const measure = () => {
      frame = 0;
      const activationLine = window.innerHeight * 0.5;
      const stageRects = nodes.map((node) => node.getBoundingClientRect());
      const firstRect = stageRects[0];
      const lastRect = stageRects[stageRects.length - 1];
      let activeStage = -1;

      if (firstRect.top <= activationLine) {
        if (lastRect.bottom <= activationLine) {
          activeStage = STAGES.length - 1;
        } else {
          const candidates = visibleStages.size > 0 ? [...visibleStages] : stageRects.map((_, index) => index);
          activeStage = candidates.reduce((closest, index) => {
            const currentDistance = Math.abs(stageRects[index].top + stageRects[index].height / 2 - activationLine);
            const closestDistance = Math.abs(stageRects[closest].top + stageRects[closest].height / 2 - activationLine);
            return currentDistance < closestDistance ? index : closest;
          }, candidates[0] ?? 0);
        }
      }

      const activeRect = activeStage >= 0 ? stageRects[activeStage] : null;
      const stageProgress = activeRect ? clamp((activationLine - activeRect.top) / activeRect.height) : 0;
      const storyRect = story.getBoundingClientRect();
      const overallProgress = clamp((activationLine - storyRect.top) / Math.max(storyRect.height, 1));
      const nextState = {
        activeStage,
        stageProgress: roundProgress(stageProgress),
        overallProgress: roundProgress(overallProgress),
      };

      setWorkflowState((current) => (
        current.activeStage === nextState.activeStage
        && current.stageProgress === nextState.stageProgress
        && current.overallProgress === nextState.overallProgress
          ? current
          : nextState
      ));
    };

    const requestMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const stage = Number((entry.target as HTMLElement).dataset.stage);
          if (entry.isIntersecting) visibleStages.add(stage);
          else visibleStages.delete(stage);
        });
        requestMeasure();
      },
      { rootMargin: "-38% 0px -38%", threshold: 0 },
    );

    nodes.forEach((node) => observer.observe(node));
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { storyRef, stageRefs, workflowState };
}

export function OperatingLoop() {
  const { storyRef, stageRefs, workflowState } = useWorkflowScrollProgress();
  const { activeStage, stageProgress, overallProgress } = workflowState;
  const currentLabel = activeStage >= 0 ? STAGES[activeStage].label : "Waiting for evidence";

  return (
    <div ref={storyRef} className={styles.workflowStory}>
      <p className="sr-only" aria-live="polite">
        Capital compiler stage: {currentLabel}.
      </p>

      <div className={styles.workflowStoryInner}>
        <div className={styles.workflowSteps}>
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const state = index < activeStage ? "complete" : index === activeStage ? "active" : "upcoming";
            const progress = state === "complete" ? 1 : state === "active" ? stageProgress : 0;

            return (
              <article
                key={stage.label}
                ref={(node) => { stageRefs.current[index] = node; }}
                data-stage={index}
                data-state={state}
                className={clsx(
                  styles.workflowStage,
                  state === "active" && styles.workflowStageActive,
                  state === "complete" && styles.workflowStageComplete,
                )}
              >
                <div className={styles.workflowStageCard}>
                  <div className="flex items-start gap-4">
                    <span className={styles.workflowStageIcon}>
                      {state === "complete" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[10px] text-blue-300">0{index + 1}</p>
                        <span className={styles.workflowStageState}>{state}</span>
                      </div>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{stage.label}</h3>
                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-resolve-muted">{stage.text}</p>
                    </div>
                  </div>
                  <div className={styles.workflowStageProgress} aria-hidden="true">
                    <span style={{ transform: `scaleX(${progress})` }} />
                  </div>
                  <MobileStageVisual stage={index} />
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.workflowVisualColumn}>
          <div className={styles.workflowSticky}>
            <CapitalCompiler
              activeStage={activeStage}
              stageProgress={stageProgress}
              overallProgress={overallProgress}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileStageVisual({ stage }: { stage: number }) {
  const Icon = STAGES[stage].icon;
  return (
    <div className={styles.workflowMobileVisual} aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">
          <Icon className="h-3.5 w-3.5" /> Compiler view
        </span>
        <span className="font-mono text-[8px] text-resolve-muted-dim">0{stage + 1}/05</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {MOBILE_STAGE_DETAILS[stage].map((detail) => (
          <span key={detail} className="rounded-lg border border-white/[0.07] bg-black/15 px-3 py-2 text-[10px] text-resolve-muted">
            {detail}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapitalCompiler({
  activeStage,
  stageProgress,
  overallProgress,
}: WorkflowState) {
  const sourceVisible = activeStage > 0 || (activeStage === 0 && stageProgress >= 0.16);
  const proofVisible = activeStage > 1 || (activeStage === 1 && stageProgress >= 0.24);
  const identityVisible = activeStage > 1 || (activeStage === 1 && stageProgress >= 0.58);
  const fundingVisible = activeStage > 3 || (activeStage === 3 && stageProgress >= 0.28);
  const authorizationReady = activeStage > 3 || (activeStage === 3 && stageProgress >= 0.62);
  const settled = activeStage === 4 && stageProgress >= 0.4;
  const finalMessageVisible = activeStage === 4 && stageProgress >= 0.68;

  return (
    <div className={clsx(styles.workflowVisual, "p-5 sm:p-6")} aria-hidden="true">
      <div className={styles.compilerHeader}>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300">Capital compiler</p>
          <p className="mt-1 text-xs text-resolve-muted">
            {activeStage >= 0 ? `Stage ${activeStage + 1} of ${STAGES.length} · ${STAGES[activeStage].label}` : "Awaiting source activity"}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[8px] text-resolve-muted">Product walkthrough</span>
      </div>

      <div className={styles.compilerOverallTrack}>
        <span style={{ transform: `scaleX(${overallProgress})` }} />
      </div>

      <div className={styles.workflowRail}>
        <div className={styles.workflowRailBase} />
        {STAGES.slice(0, -1).map((stage, index) => {
          const segmentProgress = activeStage > index ? 1 : activeStage === index ? stageProgress : 0;
          return (
            <span
              key={`${stage.label}-segment`}
              className={styles.workflowRailSegment}
              style={{ left: `${10 + index * 20}%`, transform: `scaleX(${segmentProgress})` }}
            />
          );
        })}
        <div className={styles.workflowRailNodes}>
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const nodeState = index < activeStage ? "complete" : index === activeStage ? "active" : "upcoming";
            return (
              <div key={stage.label} className={styles.workflowRailNodeWrap} data-state={nodeState}>
                <span className={styles.workflowRailNode}>
                  {nodeState === "complete" ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className={styles.workflowRailLabel}>{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.compilerBody}>
        <section className={styles.compilerPanel}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-resolve-muted-dim">Evidence packet</p>
            <span className={clsx(styles.compilerStatusDot, sourceVisible && styles.compilerStatusDotActive)} />
          </div>

          <div className={styles.compilerEvidenceList}>
            <CompilerEvidenceRow label="Source event" detail="GitHub · commit activity" visible={sourceVisible} />
            <CompilerEvidenceRow label="Proof attached" detail="Repository evidence" visible={proofVisible} />
            <CompilerEvidenceRow label="Identity resolved" detail="3 contributors" visible={identityVisible} />
          </div>

          <div className={clsx(styles.compilerContributors, identityVisible && styles.compilerItemVisible)}>
            <div className="flex -space-x-2">
              {["AK", "LM", "TS"].map((initials) => (
                <span key={initials} className="grid h-8 w-8 place-items-center rounded-full border border-[#07101e] bg-violet-500/25 text-[8px] font-semibold text-violet-100">
                  {initials}
                </span>
              ))}
            </div>
            <span className="text-[9px] text-resolve-muted">Attribution graph resolved</span>
          </div>
        </section>

        <section className={styles.compilerBlueprintPanel}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.16em] text-violet-200">Funding Blueprint</p>
              <p className="mt-1 text-[8px] text-resolve-muted-dim">Evidence-backed decision packet</p>
            </div>
            <span className="font-mono text-[8px] text-amber-200">EXAMPLE</span>
          </div>

          <div className={styles.compilerBlueprintRows}>
            {BLUEPRINT_ROWS.map((row, index) => {
              const threshold = 0.14 + index * 0.2;
              const rowProgress = activeStage > 2 ? 1 : activeStage === 2 ? clamp((stageProgress - threshold) / 0.18) : 0;
              return (
                <div key={row} className={styles.compilerBlueprintRow}>
                  <span>{row}</span>
                  <span className={styles.compilerBlueprintTrack}><span style={{ transform: `scaleX(${rowProgress})` }} /></span>
                </div>
              );
            })}
          </div>

          <div className={clsx(styles.compilerFundingPath, fundingVisible && styles.compilerItemVisible)}>
            <span className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5" /> Capital authorization</span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
            <span className="font-mono text-[8px] text-emerald-200">ARC · USDC</span>
          </div>

          <div className={clsx(styles.compilerReceipt, settled && styles.compilerReceiptSettled)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Example receipt</span>
                <p className="mt-1 text-xs font-semibold text-white">Arc settlement authorization</p>
              </div>
              <span className={clsx(styles.compilerReceiptIcon, settled && styles.compilerReceiptIconSettled)}>
                {settled ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5 text-[8px]">
              <span className="text-resolve-muted">{settled ? "Arc testnet · USDC" : authorizationReady ? "Authorized · settlement pending" : "Pending authorization"}</span>
              <span className={settled ? "text-emerald-300" : "text-resolve-muted-dim"}>{settled ? "Confirmed example" : "Not submitted"}</span>
            </div>
          </div>
        </section>
      </div>

      <div className={clsx(styles.compilerFinalMessage, finalMessageVisible && styles.compilerFinalMessageVisible)}>
        <CircleDollarSign className="h-4 w-4" />
        <span>Evidence became settlement.</span>
      </div>
    </div>
  );
}

function CompilerEvidenceRow({ label, detail, visible }: { label: string; detail: string; visible: boolean }) {
  return (
    <div className={clsx(styles.compilerEvidenceRow, visible && styles.compilerItemVisible)}>
      <span className={styles.compilerEvidenceMarker}>{visible ? <Check className="h-2.5 w-2.5" /> : null}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium text-white">{label}</span>
        <span className="mt-0.5 block truncate text-[8px] text-resolve-muted-dim">{detail}</span>
      </span>
    </div>
  );
}
