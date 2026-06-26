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
    <div className="resolve-grid-bg flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 pb-16 pt-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
      <div className="relative mx-auto w-full max-w-xl text-center">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          Money is easy.
          <span className="block text-blue-300">Knowing where it should go is hard.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-resolve-muted">
          Paste any source — repository, music instance, or connector. RESOLVE finds who created
          value, records authorizations, and prepares fulfillment.
        </p>

        <div className="mx-auto mt-8 max-w-lg rounded-xl border border-resolve-border bg-resolve-bg/80 p-2 shadow-xl backdrop-blur">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="github.com/owner/repository"
            className="w-full rounded-lg border-0 bg-transparent px-4 py-3 text-sm text-white placeholder:text-resolve-muted-dim focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={handleAnalyze}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-resolve-accent py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Analyze
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-6 text-xs text-resolve-muted-dim">
          Try{" "}
          <button
            type="button"
            onClick={() => {
              setRepoInput("navidrome/navidrome");
            }}
            className="text-resolve-accent hover:underline"
          >
            navidrome/navidrome
          </button>
        </p>
      </div>
    </div>
  );
}
