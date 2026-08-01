import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { OpportunityActions } from "@/components/resolve/discover/marketplace/opportunity-actions";
import {
  getMarketplaceOpportunityBySlug,
  listDiscoverPeople,
} from "@/lib/discover/marketplace/query";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)} ${token}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { opportunity } = await getMarketplaceOpportunityBySlug(slug);
  return opportunity
    ? { title: `${opportunity.title} — RESOLVE`, description: opportunity.summary }
    : { title: "Opportunity not found — RESOLVE" };
}

export default async function OpportunityPage({ params }: PageProps) {
  const { slug } = await params;
  const [{ opportunity, failures, requestId }, user, providers] = await Promise.all([
    getMarketplaceOpportunityBySlug(slug),
    getSessionUser().catch(() => null),
    listDiscoverPeople().catch(() => []),
  ]);
  if (!opportunity) notFound();
  const activity = await prisma.discoverOpportunityActivity
    .findMany({
      where: { opportunityId: opportunity.id },
      orderBy: { occurredAt: "desc" },
      take: 30,
      select: {
        id: true,
        eventType: true,
        summary: true,
        occurredAt: true,
      },
    })
    .catch(() => []);
  const reward = money(opportunity.reward?.amountUsd, opportunity.reward?.token);
  const funded = money(opportunity.funding?.fundedAmountUsd, opportunity.reward?.token);
  const goal = money(opportunity.funding?.goalAmountUsd, opportunity.reward?.token);
  const canManage = Boolean(user && opportunity.creator.id === user.id);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1320px] px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:pb-12">
      <Link
        href="/discover?view=explore"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Discover
      </Link>
      {failures.length > 0 && (
        <aside className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-xs text-amber-100">
          One supporting source could not refresh. This persisted opportunity is still available.
          <span className="ml-2 font-mono text-amber-200/60">request {requestId}</span>
        </aside>
      )}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <header className="rounded-[28px] border border-white/[0.08] bg-[#081321] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-violet-400/10 px-2.5 py-1 font-medium capitalize text-violet-200">
                {opportunity.type.replaceAll("_", " ")}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 capitalize text-slate-400">
                {opportunity.status}
              </span>
              {opportunity.creator.verified && (
                <span className="inline-flex items-center gap-1 text-cyan-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified owner
                </span>
              )}
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              {opportunity.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{opportunity.summary}</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" /> {opportunity.creator.name}
              </span>
              {opportunity.community && (
                <Link
                  href={`/communities/${opportunity.community.id ?? ""}`}
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  {opportunity.community.name}
                </Link>
              )}
              {opportunity.deadline && (
                <span className="inline-flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Closes {new Date(opportunity.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </header>

          <div className="mt-6 space-y-5">
            <section className="rounded-2xl border border-white/[0.08] bg-[#081321] p-6" aria-labelledby="overview">
              <h2 id="overview" className="text-lg font-semibold text-white">Overview</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{opportunity.description}</p>
              <dl className="mt-6 grid gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
                {opportunity.repository && <div><dt className="text-xs text-slate-600">Repository</dt><dd className="mt-1 break-all font-mono text-xs text-slate-300">{opportunity.repository}</dd></div>}
                {opportunity.category && <div><dt className="text-xs text-slate-600">Category</dt><dd className="mt-1 text-sm text-slate-300">{opportunity.category}</dd></div>}
                {opportunity.location && <div><dt className="text-xs text-slate-600">Location</dt><dd className="mt-1 text-sm text-slate-300">{opportunity.location}</dd></div>}
                {opportunity.estimatedDelivery && <div><dt className="text-xs text-slate-600">Estimated delivery</dt><dd className="mt-1 text-sm text-slate-300">{opportunity.estimatedDelivery}</dd></div>}
              </dl>
              {opportunity.skills.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {opportunity.skills.map((skill) => <span key={skill} className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-slate-400">{skill}</span>)}
                </div>
              )}
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-[#081321] p-6">
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white"><CheckCircle2 className="h-5 w-5 text-violet-300" /> Deliverables</h2>
                {opportunity.deliverables.length ? (
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                    {opportunity.deliverables.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />{item}</li>)}
                  </ul>
                ) : <p className="mt-4 text-sm text-slate-500">No public deliverable list has been published.</p>}
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#081321] p-6">
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white"><FileCheck2 className="h-5 w-5 text-cyan-300" /> Evidence</h2>
                {opportunity.evidenceRequirements.length ? (
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                    {opportunity.evidenceRequirements.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />{item}</li>)}
                  </ul>
                ) : <p className="mt-4 text-sm text-slate-500">Evidence rules are configured by the source program.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#081321] p-6" aria-labelledby="funding">
              <h2 id="funding" className="inline-flex items-center gap-2 text-lg font-semibold text-white"><CircleDollarSign className="h-5 w-5 text-emerald-300" /> Funding</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                {reward && <div><dt className="text-xs text-slate-600">Total reward</dt><dd className="mt-1 font-semibold text-white">{reward}</dd></div>}
                {funded && <div><dt className="text-xs text-slate-600">Funded amount</dt><dd className="mt-1 font-semibold text-emerald-300">{funded}</dd></div>}
                {goal && <div><dt className="text-xs text-slate-600">Funding goal</dt><dd className="mt-1 font-semibold text-white">{goal}</dd></div>}
                {opportunity.reward?.network && <div><dt className="text-xs text-slate-600">Network</dt><dd className="mt-1 text-sm text-slate-300">{opportunity.reward.network}</dd></div>}
                {opportunity.funding?.paymentMode && <div><dt className="text-xs text-slate-600">Payment mode</dt><dd className="mt-1 text-sm text-slate-300">{opportunity.funding.paymentMode}</dd></div>}
                {opportunity.funding?.distributionMethod && <div><dt className="text-xs text-slate-600">Distribution</dt><dd className="mt-1 text-sm text-slate-300">{opportunity.funding.distributionMethod}</dd></div>}
              </dl>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#081321] p-6" aria-labelledby="people">
              <h2 id="people" className="text-lg font-semibold text-white">People</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.07] p-4"><p className="text-xs text-slate-600">Opportunity owner</p><p className="mt-1 text-sm font-medium text-white">{opportunity.creator.name}</p></div>
                {opportunity.provider.preferred && <div className="rounded-xl border border-violet-300/15 bg-violet-300/[0.03] p-4"><p className="text-xs text-violet-300">Preferred provider</p><p className="mt-1 text-sm font-medium text-white">{opportunity.provider.preferred.name}</p></div>}
                {opportunity.provider.selected && <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.03] p-4"><p className="text-xs text-emerald-300">Selected provider</p><p className="mt-1 text-sm font-medium text-white">{opportunity.provider.selected.name}</p></div>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#081321] p-6" aria-labelledby="activity">
              <h2 id="activity" className="text-lg font-semibold text-white">Activity</h2>
              <ol className="mt-4 space-y-4">
                {activity.map((event) => (
                  <li key={event.id} className="flex gap-3 text-sm">
                    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                    <div><p className="text-slate-300">{event.summary}</p><p className="mt-1 text-xs text-slate-600">{event.occurredAt.toLocaleString()}</p></div>
                  </li>
                ))}
                <li className="flex gap-3 text-sm">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                  <div><p className="text-slate-300">Published</p><p className="mt-1 text-xs text-slate-600">{new Date(opportunity.publishedAt).toLocaleString()}</p></div>
                </li>
              </ol>
            </section>
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <OpportunityActions
            opportunity={opportunity}
            providers={providers}
            signedIn={Boolean(user)}
            canManage={canManage}
          />
        </aside>
      </div>
    </main>
  );
}
