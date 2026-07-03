"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SolveRequest = {
  prompt: string;
  serviceId: string;
  label?: string;
  /** Monotonic token so repeated Solve clicks re-trigger the effect. */
  token: number;
};

type SolveContextValue = {
  request: SolveRequest | null;
  requestSolve: (input: { prompt: string; serviceId: string; label?: string }) => void;
};

const SolveContext = createContext<SolveContextValue | null>(null);

/**
 * Bridges card "Solve with AI" clicks to the Agent Signal Market: cards call
 * requestSolve(), the market consumes the latest request (prefill → scroll → run).
 */
export function DiscoverSolveProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<SolveRequest | null>(null);

  const requestSolve = useCallback(
    (input: { prompt: string; serviceId: string; label?: string }) => {
      setRequest((prev) => ({ ...input, token: (prev?.token ?? 0) + 1 }));
    },
    [],
  );

  const value = useMemo(() => ({ request, requestSolve }), [request, requestSolve]);

  return <SolveContext.Provider value={value}>{children}</SolveContext.Provider>;
}

/** Safe accessor — returns null when rendered outside a provider. */
export function useDiscoverSolveOptional(): SolveContextValue | null {
  return useContext(SolveContext);
}
