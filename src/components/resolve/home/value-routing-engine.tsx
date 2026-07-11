import Image from "next/image";
import {
  CheckCircle2,
  CircleDollarSign,
  Code2,
  FileText,
  Music2,
  Play,
  ShieldCheck,
  Users,
} from "lucide-react";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";
import styles from "./homepage.module.css";

const EVENTS = [
  { icon: Code2, label: "GitHub contribution", meta: "Commit evidence", tone: "text-cyan-300" },
  { icon: FileText, label: "Research citation", meta: "Source reference", tone: "text-violet-300" },
  { icon: Music2, label: "Music play", meta: "Artist attribution", tone: "text-fuchsia-300" },
  { icon: Play, label: "Video watch", meta: "Completion signal", tone: "text-blue-300" },
] as const;

export function ValueRoutingEngine({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "relative" : styles.routingFrame} aria-label="Example value routing workflow">
      {!compact && (
        <div className="relative z-10 flex h-11 items-center justify-between border-b border-white/[0.07] px-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-300/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-resolve-muted-dim">
            Example workflow · Value routing engine
          </span>
          <span className="flex items-center gap-1.5 text-[9px] text-emerald-300/80">
            <ShieldCheck className="h-3 w-3" /> Verified path
          </span>
        </div>
      )}

      <div className={compact ? "relative min-h-[220px]" : "relative z-10 grid min-h-[438px] grid-cols-[1fr_1.05fr_1fr] items-center gap-3 p-5"}>
        {!compact && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 438" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="home-route" x1="0" x2="1">
                <stop offset="0" stopColor="#35c8ff" stopOpacity=".28" />
                <stop offset=".52" stopColor="#7864ff" stopOpacity=".82" />
                <stop offset="1" stopColor="#42d7ac" stopOpacity=".55" />
              </linearGradient>
            </defs>
            {[105, 180, 255, 330].map((y) => (
              <path key={y} d={`M 146 ${y} C 242 ${y}, 240 219, 348 219`} fill="none" stroke="url(#home-route)" strokeWidth="1.2" className={styles.routePath} />
            ))}
            <path d="M 405 219 C 485 219, 480 155, 548 155" fill="none" stroke="url(#home-route)" strokeWidth="1.4" className={styles.routePath} />
            <path d="M 405 219 C 500 219, 487 294, 552 294" fill="none" stroke="url(#home-route)" strokeWidth="1.4" className={styles.routePath} />
          </svg>
        )}

        {!compact && (
          <div className="relative z-10 space-y-2.5">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.17em] text-resolve-muted-dim">Source activity</p>
            {EVENTS.map(({ icon: Icon, label, meta, tone }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#071426]/90 p-2.5 shadow-[0_9px_24px_rgba(0,0,0,.18)]">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-black/20 ${tone}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold text-white">{label}</span>
                  <span className="mt-0.5 block text-[8px] text-resolve-muted-dim">{meta}</span>
                </span>
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" />
              </div>
            ))}
          </div>
        )}

        <div className={compact ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : "relative z-10 flex flex-col items-center"}>
          <div className={styles.evidenceCore}>
            <Image src={BRAND_LOGO_PATH} alt="RESOLVE" width={84} height={84} className="h-[84px] w-[84px] object-contain" priority={!compact} />
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#071426] px-2 py-1 text-[7px] uppercase tracking-wider text-blue-200">Proof</span>
            <span className="absolute -right-10 top-3 rounded-full border border-white/10 bg-[#071426] px-2 py-1 text-[7px] uppercase tracking-wider text-violet-200">Identity</span>
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#071426] px-2 py-1 text-[7px] uppercase tracking-wider text-blue-200">Policy</span>
            <span className="absolute -left-12 top-3 rounded-full border border-white/10 bg-[#071426] px-2 py-1 text-[7px] uppercase tracking-wider text-violet-200">Allocation</span>
          </div>
          {!compact && <p className="mt-12 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">RESOLVE Evidence Core</p>}
        </div>

        {!compact && (
          <div className="relative z-10 space-y-3">
            <div className="rounded-2xl border border-violet-400/20 bg-[#0b1730]/95 p-4 shadow-[0_16px_35px_rgba(0,0,0,.25)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-200">Funding Blueprint</span>
                <Users className="h-3.5 w-3.5 text-violet-300" />
              </div>
              <div className="mt-3 space-y-2 text-[9px]">
                {["Payees identified", "Policy prepared", "Evidence attached"].map((line) => (
                  <div key={line} className="flex items-center gap-2 text-resolve-muted">
                    <CheckCircle2 className="h-3 w-3 text-blue-300" /> {line}
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full w-4/5 rounded-full bg-gradient-to-r from-blue-400 to-violet-400" /></div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-[#081b21]/95 p-4 shadow-[0_16px_35px_rgba(0,0,0,.25)]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Arc settlement</span>
                <CircleDollarSign className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="mt-2 text-sm font-semibold text-white">USDC authorization</p>
              <p className="mt-1 font-mono text-[8px] text-resolve-muted-dim">Receipt produced after approval</p>
              <span className="mt-3 inline-flex rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-[8px] text-amber-200">Preview · not submitted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
