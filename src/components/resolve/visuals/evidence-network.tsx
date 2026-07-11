"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, CircleDollarSign, Code2, FileText, Music2, Play } from "lucide-react";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";

const signals = [
  { x: 32, y: 32, label: "Code", Icon: Code2, tone: "cyan" },
  { x: 32, y: 88, label: "Music", Icon: Music2, tone: "mint" },
  { x: 32, y: 144, label: "Research", Icon: FileText, tone: "violet" },
  { x: 32, y: 200, label: "Video", Icon: Play, tone: "blue" },
] as const;

export function EvidenceNetworkVisual({ className = "" }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={`evidence-network relative overflow-hidden ${visible ? "is-visible" : "is-paused"} ${className}`} aria-label="Evidence flows into funding policy and Arc settlement">
      <div className="evidence-network__grid" aria-hidden />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 240" fill="none" aria-hidden>
        <defs>
          <linearGradient id="evidence-path" x1="40" y1="120" x2="390" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#33d5ff" stopOpacity=".2" />
            <stop offset=".55" stopColor="#875cff" stopOpacity=".7" />
            <stop offset="1" stopColor="#38d7a5" stopOpacity=".45" />
          </linearGradient>
          <filter id="evidence-core-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {signals.map((signal) => (
          <path key={signal.label} d={`M55 ${signal.y} C120 ${signal.y}, 120 120, 188 120`} stroke="url(#evidence-path)" strokeWidth="1.2" strokeDasharray="3 5" />
        ))}
        <path d="M222 120H268" stroke="url(#evidence-path)" strokeWidth="1.5" />
        <path className="evidence-network__settlement-path" d="M318 120H362" stroke="url(#evidence-path)" strokeWidth="1.5" strokeDasharray="8 5" />
        <circle className="evidence-network__orbit" cx="205" cy="120" r="56" stroke="#65a8ff" strokeOpacity=".18" strokeDasharray="8 12" />
        <circle className="evidence-network__orbit evidence-network__orbit--inner" cx="205" cy="120" r="38" stroke="#875cff" strokeOpacity=".32" strokeDasharray="4 7" />
        <circle cx="205" cy="120" r="29" fill="rgba(6,13,25,.86)" stroke="#65a8ff" strokeOpacity=".65" filter="url(#evidence-core-glow)" />
        <circle cx="205" cy="120" r="20" stroke="#875cff" strokeOpacity=".55" />
        <circle cx="205" cy="120" r="4" fill="#f7f9fc" />
        {visible && <circle className="evidence-network__traveller" r="2.5" fill="#33d5ff"><animateMotion dur="5.5s" repeatCount="indefinite" path="M55 32 C120 32,120 120,188 120" /></circle>}
      </svg>

      {signals.map(({ x, y, label, Icon, tone }) => (
        <div key={label} className={`evidence-network__signal evidence-network__signal--${tone}`} style={{ left: `${x / 4.2}%`, top: `${y / 2.4}%` }}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.7} /><span>{label}</span>
        </div>
      ))}

      <div className="evidence-network__core">
        <Image src={BRAND_LOGO_PATH} alt="RESOLVE" width={60} height={60} className="evidence-network__logo" priority />
        <small>Evidence core</small>
      </div>
      <div className="evidence-network__stage evidence-network__stage--policy"><CheckCircle2 /><span>Program</span><small>Funding policy</small></div>
      <div className="evidence-network__stage evidence-network__stage--settle"><CircleDollarSign /><span>Arc</span><small>Settlement rail</small></div>
      <div className="evidence-network__legend"><span>Signals</span><i /> <span>Evidence</span><i /> <span>Capital</span></div>
    </div>
  );
}

export function DomainArtwork({ domain, className = "" }: { domain: string; className?: string }) {
  const key = domain.toLowerCase();
  return (
    <div className={`domain-artwork domain-artwork--${key} ${className}`} aria-hidden>
      <svg viewBox="0 0 120 64" fill="none">
        {key === "music" ? (
          <><path d="M8 34h9l5-16 8 34 8-25 7 15 8-28 8 38 7-24 8 13h10" /><circle cx="22" cy="18" r="3" /><circle cx="68" cy="28" r="3" /></>
        ) : key === "research" ? (
          <><circle cx="18" cy="18" r="5" /><circle cx="54" cy="14" r="6" /><circle cx="92" cy="24" r="5" /><circle cx="38" cy="48" r="4" /><circle cx="80" cy="49" r="6" /><path d="M23 18l25-3m11 2l28 6M22 22l13 22m8 3l31 2m10-5l7-15M58 19l18 25" /></>
        ) : (
          <><path d="M12 17h26v14H12zm35 0h26v14H47zm35 0h26v14H82zM30 39h26v14H30zm35 0h26v14H65z" /><path d="M38 24h9m26 0h9M25 31v8m70-8v8M56 46h9" /></>
        )}
      </svg>
    </div>
  );
}
