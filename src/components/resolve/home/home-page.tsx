"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import { toast } from "sonner";

export function HomePage() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState("");

  function handleAnalyze() {
    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      toast.error("Enter owner/repo or a GitHub URL");
      return;
    }
    router.push(`/workspace?owner=${parsed.owner}&repo=${parsed.repo}`);
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-12 resolve-grid-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]"
      />
      <div className="relative z-10 mx-auto w-full max-w-xl text-center">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          The operating system for open ecosystems.
          <span className="block text-blue-300">Discover value. Route capital. Settle globally.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-resolve-muted">
          RESOLVE discovers, authorizes, routes, and settles value across open ecosystems — from
          GitHub maintainers to musicians, researchers, and moderators. One treasury, batched Arc
          settlement, evidence-backed decisions.
        </p>

        <div className="mx-auto mt-8 max-w-lg rounded-xl border border-resolve-border bg-resolve-bg/80 p-2 shadow-xl backdrop-blur">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="owner/repository — or open workspace below"
            className="w-full rounded-lg border-0 bg-transparent px-4 py-3 text-sm text-white placeholder:text-resolve-muted-dim focus:outline-none focus:ring-0"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAnalyze}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-resolve-accent py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Analyze project
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="flex flex-1 items-center justify-center rounded-lg border border-resolve-border py-3 text-sm font-medium text-white hover:bg-resolve-hover/40"
            >
              Open workspace
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs text-resolve-muted-dim">
          Connect once. Value from code, music, research, and more streams automatically.
        </p>
      </div>
    </div>
  );
}
