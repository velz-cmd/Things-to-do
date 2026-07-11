import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  ExternalLink,
  Landmark,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";
import { Button } from "@/components/resolve/ui/button";
import { HomePrimaryCta } from "@/components/resolve/home/home-primary-cta";
import { ValueRoutingEngine } from "@/components/resolve/home/value-routing-engine";
import { ValueLeakMap } from "@/components/resolve/home/value-leak-map";
import { OperatingLoop } from "@/components/resolve/home/operating-loop";
import { WorkspacePreview } from "@/components/resolve/home/workspace-preview";
import styles from "./homepage.module.css";

const REPOSITORY_URL = "https://github.com/velz-cmd/Things-to-do";

const SOURCES = ["GitHub", "Open Collective", "OpenAlex", "Crossref", "ListenBrainz", "MusicBrainz", "Navidrome", "Jellyfin", "Arc", "Circle"] as const;

const ROLES = [
  { role: "Creators and contributors", icon: UserRound, value: "See where work is recognized", flow: ["Connect identity", "Track claimable value", "Receive settlement"], href: "/profile", cta: "Open Profile" },
  { role: "Funders", icon: Landmark, value: "Move capital with evidence", flow: ["Find opportunities", "Review evidence", "Simulate allocation", "Authorize capital"], href: "/discover", cta: "Open Discover" },
  { role: "Community operators", icon: Users, value: "Turn obligations into programs", flow: ["Install programs", "Define policies", "Review obligations", "Settle batches"], href: "/communities", cta: "Open Communities" },
  { role: "Agents", icon: Bot, value: "Purchase verified decision context", flow: ["Produce decision-ready evidence", "Create Blueprints", "Join programmable workflows"], href: "/mission", cta: "Open Mission" },
] as const;

const ARCHITECTURE = [
  { label: "Sources", items: ["GitHub", "OpenAlex", "ListenBrainz", "Jellyfin"] },
  { label: "Evidence and attribution", items: ["TypeScript", "Prisma", "Supabase"] },
  { label: "Mission intelligence", items: ["OpenRouter", "Gemini", "Groq", "Qwen"] },
  { label: "Programs and policies", items: ["Next.js", "Upstash"] },
  { label: "Capital and settlement", items: ["Circle", "Arc"] },
  { label: "Receipts and claims", items: ["Arc receipts", "Wallet claims"] },
] as const;

export function HomePage() {
  return (
    <main className={styles.page}>
      <section id="product" className={styles.hero}>
        <div className="relative z-10 max-w-[590px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300">Economic intelligence for the open internet</p>
          <h1 className="mt-6 text-[clamp(2.75rem,5vw,4.25rem)] font-semibold leading-[1.01] tracking-[-0.045em] text-white">
            RESOLVE shows where value is created—<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-violet-300 to-blue-200">and where capital should move.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[15px] leading-7 text-resolve-muted">
            RESOLVE observes verified activity across code, research, music, media, and communities—then turns the evidence into funding programs, payout policies, and Arc settlement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomePrimaryCta />
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg" className="gap-2 bg-white/[0.035]">
                See how value moves <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.08] pt-5 text-[10px] text-resolve-muted-dim">
            {["Arc testnet", "USDC settlement", "Open-source connectors", "Evidence-backed decisions"].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-300" />{item}</span>)}
          </div>
        </div>
        <div className="relative z-10 min-w-0"><ValueRoutingEngine /></div>
      </section>

      <section className={styles.sourceRail} aria-label="Supported source systems">
        <div className="grid items-center gap-4 px-5 py-5 md:grid-cols-[220px_1fr] md:px-7">
          <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300">Value already exists here</p><p className="mt-1 text-[11px] text-resolve-muted">RESOLVE connects where work already happens.</p></div>
          <div className={`${styles.sourceScroller} flex gap-2 overflow-x-auto pb-1 md:justify-end`}>
            {SOURCES.map((source) => <span key={source} className="group flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[10px] text-resolve-muted grayscale transition hover:border-blue-400/20 hover:text-white hover:grayscale-0"><span className="grid h-5 w-5 place-items-center rounded-md bg-white/[0.04] font-mono text-[8px] text-blue-300/70">{source.slice(0, 2).toUpperCase()}</span>{source}</span>)}
          </div>
        </div>
      </section>

      <section id="use-cases" className={styles.section}>
        <SectionHeading eyebrow="Value leak map" title="Where value leaks—and how RESOLVE routes it back" body="Select an industry to see the evidence input, the missing funding rule, and the route from observed work to a programmable payout mechanism." />
        <ValueLeakMap />
      </section>

      <section id="how-it-works" className="border-y border-white/[0.07] bg-[#06101f]/55">
        <div className={styles.section}>
          <SectionHeading eyebrow="The operating loop" title="From invisible work to programmable capital" body="RESOLVE moves from source activity to settlement without hiding the evidence, attribution, policy, or authorization step." />
          <OperatingLoop />
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeading eyebrow="Product workspace" title="One system. Five operating layers." body="A read-only view of the same product structure users enter through Discover, Mission, Communities, Capital, and Profile." />
        <WorkspacePreview />
      </section>

      <section className="border-y border-white/[0.07] bg-[#06101d]/55">
        <div className={styles.section}>
          <SectionHeading eyebrow="Who RESOLVE serves" title="A place for everyone who creates, funds, or operates value" body="Each role enters through a concrete workflow and leaves with evidence, a decision, or a settlement path." />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {ROLES.map(({ role, icon: Icon, value, flow, href, cta }, index) => (
              <article key={role} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-blue-400/20 hover:bg-blue-400/[0.035] sm:p-6">
                <div className="flex items-start justify-between gap-4"><span className="grid h-10 w-10 place-items-center rounded-xl border border-blue-400/20 bg-blue-400/[0.07] text-blue-300"><Icon className="h-4 w-4" /></span><span className="font-mono text-[9px] text-resolve-muted-dim">0{index + 1}</span></div>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-resolve-muted">{role}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{value}</h3>
                <div className="mt-5 flex flex-wrap gap-2">{flow.map((item) => <span key={item} className="rounded-full border border-white/[0.07] bg-black/15 px-2.5 py-1.5 text-[10px] text-resolve-muted">{item}</span>)}</div>
                <Link href={href} className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 transition group-hover:text-white">{cta}<ArrowRight className="h-3.5 w-3.5" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Arc settlement</p>
            <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">Evidence becomes settlement—not another dashboard insight</h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-resolve-muted">A Blueprint keeps the evidence, payee plan, policy, and funding requirement together. Authorization is explicit. Arc moves USDC only after approval and produces a receipt the recipient can verify.</p>
            <div className="mt-7 flex flex-wrap items-center gap-2 text-[10px] text-resolve-muted">{["Blueprint", "Authorization", "USDC batch", "Arc receipt", "Recipient wallet"].map((step, index) => <span key={step} className="flex items-center gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1.5">{step}</span>{index < 4 && <ArrowRight className="h-3 w-3 text-emerald-300/60" />}</span>)}</div>
          </div>
          <ExampleReceipt />
        </div>
      </section>

      <section id="architecture" className="border-y border-white/[0.07] bg-[#06101d]/55">
        <div className={styles.section}>
          <SectionHeading eyebrow="Open architecture" title="Built for an open, composable internet economy" body="Sources remain sources, evidence remains inspectable, and settlement remains explicit. The stack uses the technologies already present in RESOLVE." />
          <div className={`${styles.architecture} mt-12 p-5 sm:p-7`}>
            <div className="grid gap-3 lg:grid-cols-6">
              {ARCHITECTURE.map((layer, index) => <div key={layer.label} className="relative rounded-2xl border border-white/[0.07] bg-[#081629]/80 p-4"><span className="font-mono text-[8px] text-blue-300">0{index + 1}</span><h3 className="mt-2 min-h-9 text-[11px] font-semibold leading-snug text-white">{layer.label}</h3><div className="mt-4 space-y-2">{layer.items.map((item) => <span key={item} className="block rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5 text-[9px] text-resolve-muted">{item}</span>)}</div>{index < ARCHITECTURE.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-3 w-3 text-blue-300/50 lg:block" />}</div>)}
            </div>
            <div id="open-source" className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-6"><div className="flex items-center gap-3"><Code2 className="h-5 w-5 text-white" /><div><p className="text-sm font-semibold text-white">Open-source product infrastructure</p><p className="mt-0.5 text-[10px] text-resolve-muted">Inspect the implementation and contribute through the real repository.</p></div></div><a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-white transition hover:border-blue-400/30 hover:bg-blue-400/[0.07]">View source <ExternalLink className="h-3.5 w-3.5" /></a></div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} !pb-20`}>
        <div className={`${styles.conversion} grid min-h-[330px] items-center gap-8 px-6 py-12 sm:px-10 lg:grid-cols-[1fr_300px] lg:px-14`}>
          <div className="relative z-10"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">Enter the product</p><h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Value is already being created.<br />RESOLVE makes it fundable.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-resolve-muted">Discover the evidence, prepare the decision, and move capital when you are ready.</p><div className="mt-7 flex flex-wrap gap-3"><HomePrimaryCta /><a href={REPOSITORY_URL} target="_blank" rel="noreferrer"><Button variant="secondary" size="lg"><Code2 className="h-4 w-4" />View source code</Button></a></div></div>
          <div className="relative z-0 hidden min-h-[250px] lg:block"><ValueRoutingEngine compact /></div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">{eyebrow}</p><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">{title}</h2><p className="mt-5 max-w-2xl text-sm leading-7 text-resolve-muted">{body}</p></div>;
}

function ExampleReceipt() {
  const rows = [["Network", "Arc testnet"], ["Asset", "USDC"], ["Policy reference", "Created after Blueprint approval"], ["Payee count", "Calculated from verified attribution"], ["Receipt state", "Not submitted"]] as const;
  return <div className={`${styles.receipt} p-5 sm:p-7`}><div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5"><div><span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider text-amber-200">Example receipt</span><h3 className="mt-4 text-xl font-semibold text-white">Arc settlement authorization</h3><p className="mt-1 text-[10px] text-resolve-muted">Static explanatory format · no transaction created</p></div><span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"><CircleDollarSign className="h-5 w-5" /></span></div><div className="mt-5 divide-y divide-white/[0.06]">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-4 py-3"><span className="text-[10px] text-resolve-muted-dim">{label}</span><span className="text-right text-[10px] font-medium text-white">{value}</span></div>)}</div><div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/15 p-3"><span className="flex items-center gap-2 text-[9px] text-resolve-muted"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Explorer available after settlement</span><span aria-disabled="true" className="cursor-not-allowed text-[9px] text-resolve-muted-dim">View explorer</span></div></div>;
}

function Footer() {
  return <footer className="border-t border-white/[0.07] bg-[#040a13]/80"><div className="mx-auto grid max-w-[1280px] gap-8 px-6 py-10 md:grid-cols-[1fr_auto] md:items-end"><div><Link href="/" className="inline-flex items-center gap-3"><Image src={BRAND_LOGO_PATH} alt="RESOLVE" width={42} height={42} className="h-10 w-10 object-contain" /><span className="text-sm font-semibold tracking-[0.14em] text-white">RESOLVE</span></Link><p className="mt-3 max-w-sm text-xs leading-relaxed text-resolve-muted">The operating system for evidence-backed funding and programmable value on Arc.</p><p className="mt-3 text-[9px] text-resolve-muted-dim">Settlement infrastructure uses Circle-compatible USDC workflows on Arc.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-resolve-muted"><a href="#product" className="hover:text-white">Product</a><a href="#how-it-works" className="hover:text-white">How it works</a><a href="#use-cases" className="hover:text-white">Use cases</a><a href="#architecture" className="hover:text-white">Architecture</a><Link href="/mission" className="hover:text-white">Application</Link><a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/privacy" className="hover:text-white">Privacy</Link></div></div></footer>;
}
