import {
  ArrowDown,
  Brain,
  Check,
  Cloud,
  Database,
  GitBranch,
  Layers,
  Mail,
  Search,
  Shield,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { EconomicInfrastructureSection } from "@/components/resolve/stack/economic-infrastructure-section";

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "muted";
}) {
  const styles = {
    default: "border-resolve-border bg-resolve-raised text-resolve-muted",
    accent: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    muted: "border-white/10 bg-white/5 text-resolve-muted-dim",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function SectionTitle({
  title,
  badge,
  description,
}: {
  title: string;
  badge?: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {badge && <Badge variant="accent">{badge}</Badge>}
      </div>
      {description && (
        <p className="mt-1 text-sm text-resolve-muted">{description}</p>
      )}
    </div>
  );
}

function TierCard({
  icon: Icon,
  title,
  subtitle,
  items,
  accent = "sky",
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  items: string[];
  accent?: "sky" | "violet" | "emerald" | "amber";
}) {
  const iconStyles = {
    sky: "bg-sky-500/15 text-sky-300",
    violet: "bg-violet-500/15 text-violet-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
  };
  return (
    <Panel className="h-full p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[accent]}`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            {subtitle}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{title}</h3>
          <ul className="mt-3 space-y-1.5">
            {items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs leading-relaxed text-resolve-muted"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-resolve-accent/80" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function FlowStep({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-resolve-border bg-black/20 px-4 py-3 text-center">
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="mt-0.5 text-xs text-resolve-muted">{detail}</p>
    </div>
  );
}

function StackGroup({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionTitle title={title} badge={badge} />
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium text-white">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs text-resolve-muted">
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ProductionStack() {
  return (
    <div className="resolve-grid-bg min-h-screen pb-16">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <header className="mb-10">
          <Badge variant="accent">Production stack</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Built for real outcomes — not demo chatbots
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-resolve-muted">
            Multi-tier AI routing, Arc USDC settlement, and Supabase production
            infrastructure — the stack judges can verify live at{" "}
            <span className="text-white/90">resolve-task.vercel.app</span>.
          </p>
        </header>

        <div className="space-y-12">
          <EconomicInfrastructureSection />

          {/* AI Layer */}
          <section>
            <SectionTitle
              title="AI layer"
              badge="Production"
              description="Cloudflare Gateway → Groq → Llama → Gemini with automatic fallbacks"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TierCard
                icon={Brain}
                subtitle="Primary intelligence"
                title="Gemini 2.5 Flash"
                accent="violet"
                items={[
                  "Reasoning, decision-making, mission evaluation",
                  "Payment recommendations and treasury insights",
                  "Final verdicts and user-facing intelligence",
                ]}
              />
              <TierCard
                icon={Zap}
                subtitle="High-speed processing"
                title="Groq — Llama 3.1 / 3.3"
                accent="sky"
                items={[
                  "Classification, routing, scoring, and tagging",
                  "Mission priority detection",
                  "Fast structured outputs in real time",
                ]}
              />
              <TierCard
                icon={GitBranch}
                subtitle="Research & analysis"
                title="Llama 3.3 — OpenRouter"
                accent="emerald"
                items={[
                  "GitHub repository and contributor analysis",
                  "Large-document processing",
                  "Open-source ecosystem intelligence",
                ]}
              />
              <TierCard
                icon={Cloud}
                subtitle="Reliability layer"
                title="Cloudflare AI Gateway"
                accent="amber"
                items={[
                  "Request routing, analytics, and failover",
                  "Rate limiting and response caching",
                  "Unified observability across providers",
                ]}
              />
            </div>
          </section>

          {/* AI Routing */}
          <section>
            <SectionTitle
              title="AI routing"
              description="Each request flows through the right model for the job"
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-sky-300">
                  Groq → Intent & classification
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-resolve-muted">
                  <li>Categorize requests</li>
                  <li>Mission scoring</li>
                  <li>Priority detection</li>
                  <li>Fast structured outputs</li>
                </ul>
              </Panel>
              <Panel className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                  Llama → Research & analysis
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-resolve-muted">
                  <li>GitHub repository analysis</li>
                  <li>Maintainer evaluation</li>
                  <li>Contributor insights</li>
                  <li>Funding opportunity discovery</li>
                </ul>
              </Panel>
              <Panel className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-violet-300">
                  Gemini → Final reasoning
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-resolve-muted">
                  <li>Decision making</li>
                  <li>Recommendation generation</li>
                  <li>Treasury explanations</li>
                  <li>User-facing intelligence</li>
                </ul>
              </Panel>
            </div>

            <Panel className="mt-4 p-5">
              <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
                Example flow
              </p>
              <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                <FlowStep label="User request" detail="Mission, bounty, or distribution" />
                <ArrowDown className="h-4 w-4 text-resolve-muted" />
                <FlowStep label="Groq" detail="Understand intent" />
                <ArrowDown className="h-4 w-4 text-resolve-muted" />
                <FlowStep label="Llama" detail="Research & analyze" />
                <ArrowDown className="h-4 w-4 text-resolve-muted" />
                <FlowStep label="Gemini" detail="Generate final verdict" />
                <ArrowDown className="h-4 w-4 text-resolve-muted" />
                <FlowStep label="Supabase + Arc" detail="Persist outcome → release payment" />
              </div>
            </Panel>
          </section>

          {/* Unity Swarm */}
          <section>
            <SectionTitle
              title="Unity swarm"
              badge="Cross-validation"
              description="Each AI confirms the previous tier did the right work before consensus"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Panel className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-sky-300">
                  Groq — Producer
                </p>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                  Fast classification and structured outputs. First pass on intent,
                  category, and mission scoring.
                </p>
              </Panel>
              <Panel className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                  Llama — Validator
                </p>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                  Reviews Groq&apos;s output against the original task. Flags issues,
                  approves or rejects with confidence score.
                </p>
              </Panel>
              <Panel className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-violet-300">
                  Gemini — Arbiter
                </p>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                  If validator disputes, Gemini arbitrates and produces the final
                  corrected output. Research text: Llama produces → Groq validates → Gemini arbitrates.
                </p>
              </Panel>
            </div>
            <Panel className="mt-4 border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs font-medium text-emerald-300">Consensus rule</p>
              <p className="mt-2 text-sm text-resolve-muted">
                Validator confidence ≥ 75% → accept producer output. Otherwise the arbiter
                tier corrects or confirms. Every stage is logged in{" "}
                <code className="text-sky-300">/api/tasks/classify</code> and{" "}
                <code className="text-sky-300">/api/ai/swarm</code> responses.
              </p>
            </Panel>
          </section>

          {/* Why This Stack Wins */}
          <section>
            <SectionTitle title="Why this stack wins" />
            <div className="grid gap-4 md:grid-cols-2">
              <Panel className="border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs font-medium text-red-300/90">
                  Most teams build
                </p>
                <ul className="mt-3 space-y-2 text-sm text-resolve-muted">
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✕</span> One AI model
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✕</span> One workflow
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✕</span> No redundancy
                  </li>
                </ul>
              </Panel>
              <Panel className="border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-medium text-emerald-300/90">You have</p>
                <ul className="mt-3 space-y-2 text-sm text-resolve-muted">
                  {[
                    "Gemini for quality",
                    "Groq for speed",
                    "Llama for research",
                    "Unity swarm cross-validation",
                    "Cloudflare for reliability",
                    "Arc for real payments",
                    "Supabase for production infrastructure",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </section>

          {/* Core Stack */}
          <section>
            <SectionTitle
              title="Core stack"
              description="Payments, auth, and data — what judges actually care about"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <StackGroup title="Payments" badge="Must be real">
                <ListBlock
                  title="Arc testnet · USDC on Arc"
                  items={[
                    "DeputyEscrow + ERC-8183 Circle settlement",
                    "Arc Memo contract for payout refs (batch ID, mission ID)",
                    "Proof-gated release — no payout without verification",
                    "ArcScan transaction verification",
                  ]}
                />
              </StackGroup>
              <StackGroup title="Authentication" badge="Free">
                <ListBlock
                  title="Supabase Auth"
                  items={[
                    "Google login",
                    "Email magic link",
                    "Session storage and user profiles",
                    "Reown wallet connect — no Clerk or Auth0 required",
                  ]}
                />
              </StackGroup>
              <StackGroup title="Database" badge="Free">
                <ListBlock
                  title="Supabase Postgres + Prisma"
                  items={[
                    "users · missions · submissions",
                    "escrow_locks · payments · batches",
                    "treasury_events · micro_payments",
                  ]}
                />
              </StackGroup>
              <StackGroup title="Email" badge="Free">
                <ListBlock
                  title="Resend"
                  items={[
                    "Login and claim emails",
                    "Mission notifications",
                    "Payout receipts",
                  ]}
                />
              </StackGroup>
              <StackGroup title="Storage" badge="Free">
                <ListBlock
                  title="Supabase Storage"
                  items={[
                    "Screenshots and proof files",
                    "Receipts and submission artifacts",
                  ]}
                />
              </StackGroup>
            </div>
          </section>

          {/* Blockchain & Discovery */}
          <section>
            <SectionTitle title="Blockchain intelligence" badge="Free" />
            <div className="grid gap-3 sm:grid-cols-2">
              <TierCard
                icon={Wallet}
                subtitle="Arc ecosystem"
                title="Arc RPC · ArcScan"
                accent="sky"
                items={[
                  "On-chain escrow and settlement",
                  "Transaction verification for judges",
                  "EVM-compatible USDC rails",
                ]}
              />
              <TierCard
                icon={Shield}
                subtitle="Identity & labels"
                title="Alchemy · WalletLabels"
                accent="violet"
                items={[
                  "Live Arc USDC balance scan (Alchemy)",
                  "Wallet name, category, risk (WalletLabels)",
                  "Treasury transparency and counterparty recognition",
                ]}
              />
            </div>
          </section>

          <section>
            <SectionTitle
              title="Circle Agent Stack"
              badge="x402"
              description="Agents pay for paid APIs in USDC — no signup, no card, no workflow break"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TierCard
                icon={Zap}
                subtitle="Buyer — Arc testnet"
                title="GatewayClient nanopay"
                accent="emerald"
                items={[
                  "On 402 Payment Required → client.pay(url)",
                  "Gasless batched USDC via Circle Gateway",
                  "Budget-capped per mission (task.budgetUsd)",
                ]}
              />
              <TierCard
                icon={Wallet}
                subtitle="Seller — RESOLVE"
                title="x402 premium research"
                accent="sky"
                items={[
                  "GET /api/x402/premium-research (~$0.007)",
                  "Unlocks paid evidence during missions",
                  "Agent spend on mission receipt + ledger",
                ]}
              />
            </div>
            <Panel className="mt-4 border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs font-medium text-emerald-300">Flow</p>
              <p className="mt-2 text-sm text-resolve-muted">
                Mission hits paywall → agent pays 0.007 USDC → continues automatically.
                Configure <code className="text-emerald-300">ARC_AGENT_GATEWAY_PRIVATE_KEY</code> on
                Vercel. Status: <code className="text-emerald-300">GET /api/agent/gateway</code>
              </p>
            </Panel>
          </section>

          <section>
            <SectionTitle
              title="Search intelligence"
              badge="Live"
              description="Tavily → Serper → WebSearch API with 5-minute cache and automatic fallback"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <TierCard
                icon={Search}
                subtitle="Primary"
                title="Tavily"
                accent="sky"
                items={[
                  "Deep research for maintainers and funding",
                  "Domain-filtered GitHub discovery",
                  "First provider in fallback chain",
                ]}
              />
              <TierCard
                icon={Search}
                subtitle="Secondary"
                title="Serper"
                accent="violet"
                items={[
                  "Google-style SERP results",
                  "Fast structured JSON",
                  "Fallback when Tavily rate-limits",
                ]}
              />
              <TierCard
                icon={Search}
                subtitle="Tertiary"
                title="WebSearch API"
                accent="emerald"
                items={[
                  "Final fallback provider",
                  "AI-optimized web results",
                  "Retries with provider latency logs",
                ]}
              />
            </div>
            <Panel className="mt-4 border-sky-500/20 bg-sky-500/5 p-4">
              <p className="text-xs font-medium text-sky-300">Capabilities</p>
              <p className="mt-2 text-sm text-resolve-muted">
                Find repositories, maintainers, funding pages, GitHub issues, documentation,
                and payment integrations. Results deduplicated and ranked — GitHub and official
                docs prioritized. API: <code className="text-sky-300">POST /api/search</code>
              </p>
            </Panel>
          </section>

          <section>
            <SectionTitle
              title="Open-source payment discovery"
              badge="Free"
              description="GitHub API — fits the open-source payments theme"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <ListBlock
                title="Repository signals"
                items={["Repo stars", "Contributors", "Issues", "Maintainers"]}
              />
              <ListBlock
                title="Founder discovery"
                items={[
                  "Top unpaid contributors",
                  "Most active maintainers",
                  "Projects lacking funding",
                ]}
              />
            </div>
          </section>

          <section>
            <SectionTitle title="Analytics" badge="Free" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Panel className="flex items-center gap-3 p-4">
                <Cloud className="h-4 w-4 text-sky-300" />
                <div>
                  <p className="text-xs font-medium text-white">Cloudflare Analytics</p>
                  <p className="text-[10px] text-resolve-muted">AI gateway observability</p>
                </div>
              </Panel>
              <Panel className="flex items-center gap-3 p-4">
                <Layers className="h-4 w-4 text-violet-300" />
                <div>
                  <p className="text-xs font-medium text-white">Vercel Analytics</p>
                  <p className="text-[10px] text-resolve-muted">Deployment and traffic</p>
                </div>
              </Panel>
              <Panel className="flex items-center gap-3 p-4">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-xs font-medium text-white">Optional: PostHog</p>
                  <p className="text-[10px] text-resolve-muted">Product analytics layer</p>
                </div>
              </Panel>
            </div>
          </section>

          <Panel className="flex flex-wrap items-center justify-between gap-4 border-sky-500/20 bg-sky-500/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15">
                <Database className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Live status</p>
                <p className="text-xs text-resolve-muted">
                  Check configured providers at{" "}
                  <code className="text-sky-300">/api/config</code>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-resolve-muted">
              <Mail className="h-3.5 w-3.5" />
              Gemini · Groq · OpenRouter · Cloudflare Gateway
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
