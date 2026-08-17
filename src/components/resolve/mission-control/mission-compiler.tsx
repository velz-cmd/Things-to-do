"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  FileSearch,
  GitCompareArrows,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { MissionResponseCards } from "@/components/resolve/mission-control/mission-response-cards";
import {
  missionManifestSchema,
  type MissionArtifactPayload,
  type MissionKind,
  type MissionManifest,
  type RegisteredOperationType,
  type ResolveChatResponse,
  type ResolveSuggestedAction,
} from "@/lib/mission/structured-contract";

type MissionListItem = {
  id: string;
  title: string;
  objective: string;
  kind: MissionKind;
  status: string;
  stage: string | null;
  manifestVersion: number;
  updatedAt: string;
};

type Workflow = {
  mission: {
    id: string;
    title: string;
    scope: string | null;
    status: string;
    phase: string | null;
  };
  manifest: MissionManifest;
  artifacts: Array<{
    id: string;
    kind: MissionArtifactPayload["kind"];
    status: string;
    version: number;
    payload: MissionArtifactPayload;
    createdAt: string;
  }>;
  response: ResolveChatResponse;
};

type FormState = {
  kind: MissionKind;
  objective: string;
  repository: string;
  claim: string;
  optionA: string;
  optionB: string;
  criteria: string;
  constraints: string;
};

const emptyForm: FormState = {
  kind: "investigate",
  objective: "",
  repository: "",
  claim: "",
  optionA: "",
  optionB: "",
  criteria: "repository health, maintainer depth, accepted activity, funding gap",
  constraints: "",
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

function manifestFromForm(form: FormState): MissionManifest {
  const base = {
    objective: form.objective.trim(),
    constraints: form.constraints.split("\n").map((item) => item.trim()).filter(Boolean),
    sources: form.repository.trim()
      ? [{ type: "connected_repository" as const, ref: form.repository.trim() }]
      : [],
  };
  if (form.kind === "verify") {
    return missionManifestSchema.parse({ ...base, kind: "verify", claim: form.claim.trim() });
  }
  if (form.kind === "compare") {
    return missionManifestSchema.parse({
      ...base,
      kind: "compare",
      options: [form.optionA.trim(), form.optionB.trim()],
      criteria: form.criteria.split(",").map((item) => item.trim()).filter(Boolean),
    });
  }
  return missionManifestSchema.parse({ ...base, kind: "investigate" });
}

function formFromManifest(manifest: MissionManifest): FormState {
  return {
    kind: manifest.kind,
    objective: manifest.objective,
    repository: manifest.sources[0]?.ref ?? "",
    claim: manifest.kind === "verify" ? manifest.claim : "",
    optionA: manifest.kind === "compare" ? manifest.options[0] ?? "" : "",
    optionB: manifest.kind === "compare" ? manifest.options[1] ?? "" : "",
    criteria: manifest.kind === "compare" ? manifest.criteria.join(", ") : emptyForm.criteria,
    constraints: manifest.constraints.join("\n"),
  };
}

function kindLabel(kind: MissionKind) {
  return kind[0]!.toUpperCase() + kind.slice(1);
}

/**
 * Stage/status in customer language. The library card used to render the raw
 * value - "collect_evidence", "handoff_communities" - directly, which is
 * internal operation-type vocabulary from structured-contract.ts, not
 * something a person deciding whether to open a Mission needs to parse.
 */
const MISSION_STAGE_LABELS: Record<string, string> = {
  collect_evidence: "Collecting evidence",
  verify_claim: "Verifying claim",
  compare_options: "Comparing options",
  run_simulation: "Simulating",
  create_blueprint: "Drafting decision",
  request_approval: "Awaiting your approval",
  approve_blueprint: "Approved",
  handoff_communities: "Handed off to Communities",
  prepare_capital_review: "Ready for funding review",
  created: "Draft",
  running: "Running",
  executing: "Running",
  awaiting_user: "Needs your review",
  completed: "Complete",
  blocked: "Needs attention",
  failed: "Needs attention",
  cancelled: "Cancelled",
};

function missionStageLabel(stage?: string | null): string {
  if (!stage) return "Draft";
  // Keys are stored without the "mission." prefix used in
  // structured-contract.ts; strip it before lookup so either form matches.
  const key = stage.replace(/^mission\./, "");
  const mapped = MISSION_STAGE_LABELS[key] ?? MISSION_STAGE_LABELS[stage];
  if (mapped) return mapped;
  const words = key.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function MissionCompiler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showComposer, setShowComposer] = useState(!selectedId);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runningOperation, setRunningOperation] = useState<RegisteredOperationType | "create" | null>(null);
  const [confirmAction, setConfirmAction] = useState<ResolveSuggestedAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [retryAction, setRetryAction] = useState<ResolveSuggestedAction | null>(null);

  const loadMissions = useCallback(async () => {
    const response = await fetch("/api/mission/workflows", { cache: "no-store" });
    if (response.status === 401) {
      setAuthRequired(true);
      setMissions([]);
      return;
    }
    const body = await readJson<{ missions: MissionListItem[] }>(response);
    setMissions(body.missions);
  }, []);

  const loadWorkflow = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const body = await readJson<{ workflow: Workflow }>(
        await fetch(`/api/mission/workflows/${encodeURIComponent(id)}`, { cache: "no-store" }),
      );
      setWorkflow(body.workflow);
      setShowComposer(false);
      setAuthRequired(false);
    } catch (loadError) {
      setWorkflow(null);
      setError(loadError instanceof Error ? loadError.message : "Mission could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMissions().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Mission library could not be loaded.");
    }).finally(() => {
      if (!selectedId) setLoading(false);
    });
  }, [loadMissions, selectedId]);

  useEffect(() => {
    if (selectedId) void loadWorkflow(selectedId);
  }, [loadWorkflow, selectedId]);

  const manifestVersion = useMemo(() => {
    return workflow?.artifacts
      .filter((artifact) => artifact.kind === "manifest")
      .reduce((version, artifact) => Math.max(version, artifact.version), 1) ?? 1;
  }, [workflow]);

  const plan = useMemo(() => {
    const artifact = workflow?.artifacts.findLast((item) => item.kind === "plan");
    return artifact?.payload.kind === "plan" ? artifact.payload : null;
  }, [workflow]);

  function startNew() {
    setWorkflow(null);
    setForm(emptyForm);
    setEditing(false);
    setShowComposer(true);
    setError(null);
    router.replace("/mission");
  }

  async function submitMission() {
    setError(null);
    let manifest: MissionManifest;
    try {
      manifest = manifestFromForm(form);
    } catch {
      setError("Complete the objective and every required field for the selected mission type.");
      return;
    }
    setRunningOperation(editing ? "mission.modify_requirements" : "create");
    try {
      if (editing && workflow) {
        const body = await readJson<{ workflow: Workflow }>(
          await fetch(`/api/mission/workflows/${encodeURIComponent(workflow.mission.id)}/operations`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              operationType: "mission.modify_requirements",
              idempotencyKey: crypto.randomUUID(),
              expectedVersion: manifestVersion,
              payload: { manifest },
            }),
          }),
        );
        setWorkflow(body.workflow);
        setEditing(false);
        setShowComposer(false);
      } else {
        const body = await readJson<{ workflow: Workflow }>(
          await fetch("/api/mission/workflows", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(manifest),
          }),
        );
        setWorkflow(body.workflow);
        setShowComposer(false);
        router.replace(`/mission?id=${encodeURIComponent(body.workflow.mission.id)}`);
      }
      await loadMissions();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Mission could not be saved.";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setAuthRequired(true);
    } finally {
      setRunningOperation(null);
    }
  }

  async function executeAction(suggested: ResolveSuggestedAction, confirmed = false) {
    if (!workflow || runningOperation || !suggested.enabled) return;
    if (suggested.operationType === "mission.modify_requirements") {
      setForm(formFromManifest(workflow.manifest));
      setEditing(true);
      setShowComposer(true);
      return;
    }
    if (suggested.requiresConfirmation && !confirmed) {
      setConfirmAction(suggested);
      return;
    }
    setConfirmAction(null);
    setRunningOperation(suggested.operationType);
    setRetryAction(null);
    setError(null);
    try {
      const payload = suggested.requiresConfirmation
        ? { ...suggested.payload, confirmation: true }
        : suggested.payload;
      const response = await fetch(`/api/mission/workflows/${encodeURIComponent(workflow.mission.id)}/operations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationType: suggested.operationType,
          idempotencyKey: crypto.randomUUID(),
          expectedVersion: manifestVersion,
          payload,
        }),
      });
      const body = await response.json().catch(() => ({})) as { workflow?: Workflow; error?: string };
      if (!response.ok || !body.workflow) {
        if (body.workflow) setWorkflow(body.workflow);
        throw new Error(body.error ?? `Mission operation failed (${response.status}).`);
      }
      setWorkflow(body.workflow);
      await loadMissions();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Mission operation failed.");
      setRetryAction(suggested);
    } finally {
      setRunningOperation(null);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-86px)] max-w-[1500px] gap-4 px-3 py-4 md:px-5 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="order-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3 lg:order-1">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-violet-300">Mission library</p>
            <p className="mt-1 text-xs text-slate-500">{missions.length} persisted</p>
          </div>
          <button type="button" onClick={startNew} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-violet-300/40 hover:text-white" aria-label="Create mission">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {missions.map((mission) => (
            <button
              key={mission.id}
              type="button"
              onClick={() => router.replace(`/mission?id=${encodeURIComponent(mission.id)}`)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                workflow?.mission.id === mission.id
                  ? "border-violet-300/35 bg-violet-300/[0.08]"
                  : "border-transparent bg-white/[0.025] hover:border-white/10"
              }`}
            >
              {/* manifest version is internal bookkeeping - it lives in the
                  mission detail, not on the card a person scans to pick a
                  Mission. */}
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">{mission.kind}</span>
              <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-200">{mission.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">{missionStageLabel(mission.stage ?? mission.status)}</p>
            </button>
          ))}
          {!loading && missions.length === 0 && !authRequired && (
            <p className="px-2 py-4 text-xs leading-5 text-slate-500">Your first persisted decision will appear here.</p>
          )}
        </div>
      </aside>

      <main className="order-1 min-w-0 overflow-hidden rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_top,#172450,transparent_42%),#060b19] shadow-2xl shadow-violet-950/25 lg:order-2">
        <header className="border-b border-white/8 px-5 py-4 md:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {/* Was "Evidence-to-decision compiler" over "Build a decision
                  judges can inspect": internal architecture wording plus an
                  audience this product does not have. The heading now states
                  the objective, which is what the page is actually about. */}
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-violet-300">Mission</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {workflow ? workflow.mission.title : "What should RESOLVE decide?"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {/* manifest v3 is internal bookkeeping, not something a person
                    making a funding decision needs on the primary heading. It
                    remains available in the mission details. */}
                {workflow
                  ? `${kindLabel(workflow.manifest.kind)} mission · ${workflow.mission.status}`
                  : "Describe the outcome you want RESOLVE to reach. It will gather the evidence it needs and come back with a decision you approve."}
              </p>
            </div>
            {workflow && (
              <button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-violet-300/40 hover:text-white">
                <Plus className="h-3.5 w-3.5" /> New mission
              </button>
            )}
          </div>
        </header>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 p-4 md:p-6">
            {authRequired && (
              <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                <p className="text-sm font-medium text-amber-100">Sign in to persist Mission evidence and approvals.</p>
                <Link href="/?auth=signin&returnTo=%2Fmission" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-300">
                  Sign in <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {error && (
              <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.045] p-4">
                <div className="flex min-w-0 items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <p className="text-sm text-rose-100">{error}</p>
                </div>
                {retryAction && (
                  <button type="button" onClick={() => void executeAction(retryAction)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200/20 px-3 py-2 text-xs text-rose-100">
                    <RotateCcw className="h-3.5 w-3.5" /> Retry safely
                  </button>
                )}
              </div>
            )}

            {showComposer && (
              <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">{editing ? "Revise mission requirements" : "Create mission"}</h2>
                    <p className="mt-1 text-xs text-slate-400">Requirements are stored as a typed manifest. Later edits create a new version.</p>
                  </div>
                  {editing && (
                    <button type="button" onClick={() => { setEditing(false); setShowComposer(false); }} className="text-xs text-slate-400 hover:text-white">Cancel edit</button>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(["investigate", "verify", "compare"] as MissionKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, kind }))}
                      className={`rounded-xl border p-3 text-left ${
                        form.kind === kind ? "border-violet-300/45 bg-violet-300/[0.09]" : "border-white/8 bg-white/[0.025]"
                      }`}
                    >
                      {kind === "compare" ? <GitCompareArrows className="h-4 w-4 text-violet-300" />
                        : kind === "verify" ? <ShieldCheck className="h-4 w-4 text-violet-300" />
                        : <FileSearch className="h-4 w-4 text-violet-300" />}
                      <span className="mt-2 block text-xs font-medium text-white">{kindLabel(kind)}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-xs font-medium text-slate-200" htmlFor="mission-objective">Decision objective</label>
                <textarea
                  id="mission-objective"
                  value={form.objective}
                  onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
                  placeholder="Decide which repository is safer to deploy and explain the evidence."
                  className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none ring-violet-400/50 placeholder:text-slate-600 focus:ring-2"
                />
                {form.kind === "verify" && (
                  <>
                    <label className="mt-4 block text-xs font-medium text-slate-200" htmlFor="mission-claim">Claim to verify</label>
                    <textarea id="mission-claim" value={form.claim} onChange={(event) => setForm((current) => ({ ...current, claim: event.target.value }))} className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none focus:border-violet-300/40" placeholder="The release was authored and reviewed by the declared maintainers." />
                  </>
                )}
                {form.kind === "compare" && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-200" htmlFor="mission-option-a">Option A</label>
                      <input id="mission-option-a" value={form.optionA} onChange={(event) => setForm((current) => ({ ...current, optionA: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none focus:border-violet-300/40" placeholder="owner/repository-a" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-200" htmlFor="mission-option-b">Option B</label>
                      <input id="mission-option-b" value={form.optionB} onChange={(event) => setForm((current) => ({ ...current, optionB: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none focus:border-violet-300/40" placeholder="owner/repository-b" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-200" htmlFor="mission-criteria">Criteria, comma separated</label>
                      <input id="mission-criteria" value={form.criteria} onChange={(event) => setForm((current) => ({ ...current, criteria: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none focus:border-violet-300/40" />
                    </div>
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-200" htmlFor="mission-repository">Primary repository source</label>
                    <input id="mission-repository" value={form.repository} onChange={(event) => setForm((current) => ({ ...current, repository: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none focus:border-violet-300/40" placeholder="owner/repository" />
                    <p className="mt-1 text-[11px] text-slate-500">Uses the latest persisted Discover snapshot.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-200" htmlFor="mission-constraints">Constraints, one per line</label>
                    <textarea id="mission-constraints" value={form.constraints} onChange={(event) => setForm((current) => ({ ...current, constraints: event.target.value }))} className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none focus:border-violet-300/40" placeholder="Do not infer missing ownership&#10;Use only persisted evidence" />
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="mission-create"
                  disabled={runningOperation !== null || form.objective.trim().length < 8}
                  onClick={() => void submitMission()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {runningOperation ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {editing ? "Save new manifest version" : "Create persisted mission"}
                </button>
              </section>
            )}

            {loading && !showComposer && (
              <div className="flex min-h-64 items-center justify-center text-sm text-slate-400">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Restoring mission state
              </div>
            )}

            {workflow && !showComposer && !loading && (
              <div className="space-y-4">
                <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Resolve response</p>
                    <span className="text-[11px] text-slate-500">{new Date(workflow.response.message.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-3 text-base font-medium leading-7 text-white">{workflow.response.message.summary}</p>
                  {workflow.response.message.details && <p className="mt-2 text-sm text-slate-400">{workflow.response.message.details}</p>}
                </article>
                <MissionResponseCards cards={workflow.response.cards ?? []} />
                <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4" aria-label="Suggested actions">
                  <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">Next valid actions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(workflow.response.suggestedActions ?? []).map((suggested) => (
                      <button
                        key={suggested.id}
                        type="button"
                        data-operation-type={suggested.operationType}
                        disabled={!suggested.enabled || runningOperation !== null}
                        title={!suggested.enabled ? suggested.disabledReason : suggested.description}
                        onClick={() => void executeAction(suggested)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          suggested.variant === "primary"
                            ? "border-violet-300/35 bg-violet-500 text-white hover:bg-violet-400"
                            : suggested.variant === "danger"
                              ? "border-rose-300/25 bg-rose-300/[0.06] text-rose-100"
                              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-violet-300/30"
                        }`}
                      >
                        {runningOperation === suggested.operationType ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                        {suggested.label}
                      </button>
                    ))}
                  </div>
                  {(workflow.response.suggestedActions ?? []).some((suggested) => !suggested.enabled) && (
                    <p className="mt-3 text-xs text-slate-500">
                      {(workflow.response.suggestedActions ?? []).find((suggested) => !suggested.enabled)?.disabledReason}
                    </p>
                  )}
                </section>
              </div>
            )}
          </section>

          <aside className="border-t border-white/8 bg-slate-950/35 p-4 xl:border-l xl:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-violet-300">Mission plan</p>
            {plan ? (
              <ol className="mt-4 space-y-3">
                {plan.steps.map((step, index) => {
                  const stage = workflow?.response.workflowState?.stage ?? "planned";
                  const completed = index === 0 && stage !== "planned"
                    || index === 1 && ["verify_claim", "compare_options", "run_simulation", "create_blueprint", "request_approval", "approve_blueprint", "handoff_communities", "prepare_capital_review"].includes(stage)
                    || index === 2 && ["run_simulation", "create_blueprint", "request_approval", "approve_blueprint", "handoff_communities", "prepare_capital_review"].includes(stage)
                    || index === 3 && ["create_blueprint", "request_approval", "approve_blueprint", "handoff_communities", "prepare_capital_review"].includes(stage)
                    || index === 4 && ["approve_blueprint", "handoff_communities", "prepare_capital_review"].includes(stage)
                    || index === 5 && ["handoff_communities", "prepare_capital_review"].includes(stage);
                  return (
                    <li key={step.id} className="flex gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        completed ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-300" : "border-white/10 text-slate-500"
                      }`}>{completed ? <Check className="h-3 w-3" /> : index + 1}</span>
                      <div>
                        <p className={`text-xs font-medium ${completed ? "text-slate-200" : "text-slate-400"}`}>{step.label}</p>
                        {step.prerequisite && <p className="mt-1 text-[11px] text-slate-600">{step.prerequisite}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-4 text-xs leading-5 text-slate-500">Create a mission to compile its editable requirements into a persisted execution plan.</p>
            )}
            {workflow && (
              <div className="mt-6 border-t border-white/8 pt-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Audit state</p>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Artifacts</dt><dd className="text-slate-300">{workflow.artifacts.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Manifest</dt><dd className="text-slate-300">v{manifestVersion}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Stage</dt><dd className="max-w-36 truncate text-slate-300">{workflow.response.workflowState?.stage ?? "planned"}</dd></div>
                </dl>
              </div>
            )}
          </aside>
        </div>
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mission-confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#08101f] p-5 shadow-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-amber-200">Explicit confirmation</p>
            <h2 id="mission-confirm-title" className="mt-2 text-lg font-semibold text-white">{confirmAction.label}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{confirmAction.description ?? "Review this operation before continuing."}</p>
            <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-400">
              {confirmAction.operationType === "mission.prepare_capital_review"
                ? "This creates a Capital review package. It does not move funds."
                : confirmAction.operationType === "mission.approve_blueprint"
                  ? "Approval freezes the selected Blueprint version. Later edits create a new version."
                  : confirmAction.operationType === "mission.cancel"
                    ? "Cancellation stops new operations and preserves the Mission audit history."
                  : "This creates a persisted handoff receipt. External execution remains separate."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAction(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button>
              <button type="button" onClick={() => void executeAction(confirmAction, true)} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400">Confirm operation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
