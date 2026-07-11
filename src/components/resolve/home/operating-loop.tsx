"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDollarSign, Eye, FileCheck2, Landmark, Network, Users } from "lucide-react";
import clsx from "clsx";
import styles from "./homepage.module.css";

const STAGES = [
  { label: "Observe", text: "Sources detect activity where work already happens.", icon: Eye },
  { label: "Verify", text: "RESOLVE links evidence to contributors and communities.", icon: FileCheck2 },
  { label: "Blueprint", text: "Mission converts the evidence into a decision-ready payout plan.", icon: Network },
  { label: "Fund", text: "Operators or communities approve and fund the policy.", icon: Landmark },
  { label: "Settle", text: "Arc moves USDC and produces a public receipt.", icon: CircleDollarSign },
] as const;

export function OperatingLoop() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.stage ?? 0));
      },
      { rootMargin: "-30% 0px -45%", threshold: [0.1, 0.45, 0.8] },
    );
    refs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="space-y-3 lg:py-16">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.label}
              ref={(node) => { refs.current[index] = node; }}
              data-stage={index}
              className={clsx("min-h-[180px] rounded-2xl border p-5 transition duration-300 lg:min-h-[230px]", active === index ? "border-blue-400/28 bg-blue-400/[0.07]" : "border-white/[0.06] bg-white/[0.015]")}
            >
              <div className="flex items-start gap-4">
                <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", active === index ? "border-blue-400/30 bg-blue-400/10 text-blue-300" : "border-white/[0.08] text-resolve-muted")}><Icon className="h-4 w-4" /></span>
                <div>
                  <p className="font-mono text-[10px] text-blue-300">0{index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{stage.label}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-resolve-muted">{stage.text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={clsx(styles.workflowVisual, "p-5 sm:p-7")}>
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
          <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300">Capital compiler</p><p className="mt-1 text-xs text-resolve-muted">Stage {active + 1} of {STAGES.length}</p></div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[8px] text-resolve-muted">Scroll-linked product view</span>
        </div>

        <div className="relative mt-8">
          <div className="absolute left-[7%] right-[7%] top-5 h-px bg-white/[0.07]" />
          <div className={clsx(styles.workflowBeam, "absolute left-[7%] top-5 h-px bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 shadow-[0_0_14px_rgba(85,104,255,.7)]")} style={{ width: `${(active / (STAGES.length - 1)) * 86}%` }} />
          <div className="relative grid grid-cols-5 gap-1">
            {STAGES.map((stage, index) => {
              const Icon = stage.icon;
              return <div key={stage.label} className="flex flex-col items-center gap-2 text-center"><span className={clsx("z-10 grid h-10 w-10 place-items-center rounded-full border transition", index <= active ? "border-blue-300/45 bg-[#10254a] text-blue-200 shadow-[0_0_18px_rgba(67,112,255,.25)]" : "border-white/[0.08] bg-[#091323] text-resolve-muted-dim")}><Icon className="h-4 w-4" /></span><span className="hidden text-[8px] uppercase tracking-wider text-resolve-muted sm:block">{stage.label}</span></div>;
            })}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
            <p className="text-[9px] uppercase tracking-[0.16em] text-resolve-muted-dim">Evidence packet</p>
            <div className="mt-4 space-y-3">
              {["Source event", "Proof attached", "Identity resolved"].map((line, index) => <div key={line} className={clsx("flex items-center gap-2 text-[10px] transition", active >= index ? "text-white" : "text-resolve-muted-dim")}><span className={clsx("h-1.5 w-1.5 rounded-full", active >= index ? "bg-blue-300" : "bg-white/10")} />{line}</div>)}
            </div>
            <div className="mt-5 flex -space-x-2">
              {[0, 1, 2].map((node) => <span key={node} className={clsx("grid h-8 w-8 place-items-center rounded-full border border-[#07101e] text-[9px]", active >= 1 ? "bg-violet-500/30 text-violet-100" : "bg-white/[0.05] text-resolve-muted-dim")}><Users className="h-3 w-3" /></span>)}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-400/18 bg-violet-400/[0.05] p-4">
            <div className="flex items-center justify-between"><p className="text-[9px] uppercase tracking-[0.16em] text-violet-200">Funding Blueprint</p><span className="font-mono text-[8px] text-resolve-muted-dim">EXAMPLE</span></div>
            <div className="mt-4 space-y-3">
              {["Payee plan", "Allocation policy", "Funding requirement", "Settlement path"].map((line, index) => <div key={line} className="flex items-center justify-between gap-3"><span className="text-[10px] text-resolve-muted">{line}</span><span className={clsx("h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]")}><span className={clsx("block h-full rounded-full transition-all duration-500", active >= Math.min(index + 2, 4) ? "w-full bg-gradient-to-r from-blue-400 to-violet-400" : "w-0")} /></span></div>)}
            </div>
            <div className={clsx("mt-5 rounded-xl border p-3 transition", active >= 4 ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-white/[0.07] bg-black/10")}><div className="flex items-center justify-between"><span className="text-[9px] text-resolve-muted">Arc receipt</span><span className={clsx("text-[8px] font-medium", active >= 4 ? "text-emerald-300" : "text-resolve-muted-dim")}>{active >= 4 ? "Ready after approval" : "Pending authorization"}</span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
