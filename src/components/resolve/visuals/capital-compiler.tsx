import { BadgeDollarSign, FileCheck2, GitBranch, ShieldCheck, UsersRound } from "lucide-react";

export function CapitalCompilerVisual({ className = "" }: { className?: string }) {
  return (
    <div className={`capital-compiler ${className}`} aria-label="Capital compiler: evidence becomes policy, payees, allocation, and Arc authorization">
      <div className="capital-compiler__grid" aria-hidden />
      <svg viewBox="0 0 460 230" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="compiler-path" x1="20" y1="115" x2="438" y2="115" gradientUnits="userSpaceOnUse"><stop stopColor="#33d5ff" /><stop offset=".52" stopColor="#875cff" /><stop offset="1" stopColor="#38d7a5" /></linearGradient>
        </defs>
        <path d="M50 55C110 55 110 115 158 115M50 115H158M50 175C110 175 110 115 158 115" stroke="url(#compiler-path)" strokeOpacity=".55" strokeDasharray="3 5" />
        <path d="M218 115H260M330 115H375" stroke="url(#compiler-path)" strokeOpacity=".7" />
        <path d="M295 82V56M295 148V174" stroke="url(#compiler-path)" strokeOpacity=".35" />
      </svg>
      <CompilerNode className="left-[4%] top-[17%]" icon={<GitBranch />} label="Evidence" meta="verified signals" />
      <CompilerNode className="left-[4%] top-[43%]" icon={<FileCheck2 />} label="Scope" meta="objective" />
      <CompilerNode className="left-[4%] top-[69%]" icon={<UsersRound />} label="Identity" meta="contributors" />
      <div className="capital-compiler__engine"><span className="capital-compiler__rings" /><ShieldCheck /><strong>Policy engine</strong><small>rules · confidence</small></div>
      <div className="capital-compiler__table"><span>PAYEE TABLE</span><i /><i /><i /><small>3 verified rows</small></div>
      <div className="capital-compiler__allocation"><BadgeDollarSign /><strong>Allocation</strong><div><i style={{width:"64%"}} /><i style={{width:"46%"}} /><i style={{width:"30%"}} /></div></div>
      <div className="capital-compiler__arc"><span>ARC</span><strong>Authorize</strong><small>USDC settlement</small></div>
      <div className="capital-compiler__caption">Evidence → policy → payees → capital</div>
    </div>
  );
}

function CompilerNode({ className, icon, label, meta }: { className: string; icon: React.ReactNode; label: string; meta: string }) {
  return <div className={`capital-compiler__node ${className}`}>{icon}<span><strong>{label}</strong><small>{meta}</small></span></div>;
}

export function TemplateDiagram({ id }: { id: string }) {
  const kind = id.toLowerCase();
  return <div className={`template-diagram template-diagram--${kind}`} aria-hidden><svg viewBox="0 0 110 46" fill="none">
    {kind.includes("citation") ? <><rect x="7" y="8" width="25" height="30" rx="3"/><circle cx="70" cy="12" r="5"/><circle cx="94" cy="23" r="5"/><circle cx="68" cy="36" r="5"/><path d="M32 22h22m4-7l-6 7 8 10m15-18l14 7M75 34l14-8"/></> : kind.includes("royalty") ? <><path d="M5 24h8l5-14 8 28 8-22 8 15 8-12 8 8h8"/><path d="M68 27h18m-8-8 8 8-8 8M86 27h17"/></> : kind.includes("docs") ? <><rect x="8" y="8" width="30" height="30" rx="3"/><path d="M15 16h16M15 23h16M15 30h10M38 23h24m0 0-7-7m7 7-7 7M68 13h34v20H68z"/></> : <><circle cx="15" cy="14" r="5"/><circle cx="15" cy="32" r="5"/><circle cx="42" cy="23" r="8"/><path d="M20 15l14 5M20 31l14-5M50 23h22"/><rect x="72" y="11" width="31" height="24" rx="5"/></>}
  </svg></div>;
}
