"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  FUND_ACTION_RECORDED_EVENT,
  FUND_CARD_DISMISSED_EVENT,
  latestFundForProgram,
  listFundActions,
  totalFundedForCommunity,
  totalFundedForProgram,
  type StoredFundAction,
} from "@/lib/capital/fund-action-store";

type ProgramStakeSummary = {
  programId: string;
  programName: string;
  communitySlug: string | null;
  totalPrincipalUsd: number;
  lastFundedAt: string;
  stakeCount: number;
};

async function fetchMyStakes(): Promise<{
  stakes: ProgramStakeSummary[];
  byProgramId: Record<string, ProgramStakeSummary>;
}> {
  const res = await fetch("/api/capital/my-stakes", { credentials: "include", cache: "no-store" });
  if (!res.ok) return { stakes: [], byProgramId: {} };
  return res.json();
}

export function useMyPoolStakes() {
  const queryClient = useQueryClient();
  const [localVersion, setLocalVersion] = useState(0);

  const query = useQuery({
    queryKey: queryKeys.myPoolStakes,
    queryFn: fetchMyStakes,
    staleTime: 30_000,
  });

  useEffect(() => {
    function onRecorded() {
      setLocalVersion((v) => v + 1);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPoolStakes });
    }
    function onDismissed() {
      setLocalVersion((v) => v + 1);
    }
    window.addEventListener(FUND_ACTION_RECORDED_EVENT, onRecorded);
    window.addEventListener(FUND_CARD_DISMISSED_EVENT, onDismissed);
    return () => {
      window.removeEventListener(FUND_ACTION_RECORDED_EVENT, onRecorded);
      window.removeEventListener(FUND_CARD_DISMISSED_EVENT, onDismissed);
    };
  }, [queryClient]);

  const fundedUsdForProgram = useCallback(
    (programId?: string | null): number => {
      if (!programId) return 0;
      const server = query.data?.byProgramId[programId]?.totalPrincipalUsd ?? 0;
      const local = totalFundedForProgram(programId);
      return Math.max(server, local);
    },
    [query.data?.byProgramId, localVersion],
  );

  const fundedUsdForCommunity = useCallback(
    (communitySlug?: string | null, templateId?: string | null): number => {
      if (!communitySlug) return 0;
      const server = Object.values(query.data?.byProgramId ?? {}).reduce((s, row) => {
        if (row.communitySlug !== communitySlug) return s;
        return s + row.totalPrincipalUsd;
      }, 0);
      const local = totalFundedForCommunity(communitySlug, templateId);
      return Math.max(server, local);
    },
    [query.data?.byProgramId, localVersion],
  );

  const latestForProgram = useCallback(
    (programId?: string | null): StoredFundAction | ProgramStakeSummary | null => {
      if (!programId) return null;
      const local = latestFundForProgram(programId);
      const server = query.data?.byProgramId[programId];
      if (server && (!local || server.lastFundedAt >= local.at)) return server;
      return local;
    },
    [query.data?.byProgramId, localVersion],
  );

  return {
    ...query,
    fundedUsdForProgram,
    fundedUsdForCommunity,
    latestForProgram,
    localActions: listFundActions(),
  };
}
