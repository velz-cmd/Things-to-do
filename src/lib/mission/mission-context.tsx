"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseRepoInput } from "@/lib/workspace/parse-repo";

export type MissionScope = {
  id: string;
  label: string;
  kind: "repository" | "query" | "community";
  owner?: string;
  repo?: string;
  query?: string;
};

type MissionContextValue = {
  scope: MissionScope | null;
  setScope: (scope: MissionScope | null) => void;
  enterMission: (input: string) => void;
};

const MissionContext = createContext<MissionContextValue | null>(null);

function scopeFromParams(
  scopeParam: string | null,
  missionParam: string | null,
): MissionScope | null {
  const raw = scopeParam ?? missionParam;
  if (!raw) return null;

  const parsed = parseRepoInput(raw);
  if (parsed) {
    return {
      id: `${parsed.owner}/${parsed.repo}`,
      label: `${parsed.owner}/${parsed.repo}`,
      kind: "repository",
      owner: parsed.owner,
      repo: parsed.repo,
    };
  }

  return {
    id: raw,
    label: raw,
    kind: "query",
    query: raw,
  };
}

export function MissionScopeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [scope, setScopeState] = useState<MissionScope | null>(null);

  useEffect(() => {
    const next = scopeFromParams(
      searchParams.get("scope"),
      searchParams.get("mission"),
    );
    setScopeState(next);
  }, [searchParams]);

  const setScope = useCallback(
    (next: MissionScope | null) => {
      setScopeState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("mission");
      if (next) {
        params.set("scope", next.owner && next.repo ? `${next.owner}/${next.repo}` : next.label);
      } else {
        params.delete("scope");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const enterMission = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      const parsed = parseRepoInput(trimmed);
      const next: MissionScope = parsed
        ? {
            id: `${parsed.owner}/${parsed.repo}`,
            label: `${parsed.owner}/${parsed.repo}`,
            kind: "repository",
            owner: parsed.owner,
            repo: parsed.repo,
          }
        : {
            id: trimmed,
            label: trimmed,
            kind: "query",
            query: trimmed,
          };

      setScope(next);
      if (!pathname.startsWith("/mission")) {
        router.push(`/mission?scope=${encodeURIComponent(next.label)}`);
      }
    },
    [pathname, router, setScope],
  );

  const value = useMemo(
    () => ({ scope, setScope, enterMission }),
    [scope, setScope, enterMission],
  );

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMissionScope() {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error("useMissionScope must be used within MissionScopeProvider");
  return ctx;
}
