"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  readSessionMemory,
  writeSessionMemory,
} from "@/lib/resolve/workspace-memory";

type CommandContextValue = {
  draft: string;
  setDraft: (v: string) => void;
  focusBar: () => void;
  registerFocus: (fn: () => void) => void;
  submitFromHome: (text: string) => void;
  transitioning: boolean;
  pendingTask: string | null;
  clearPendingTask: () => void;
  registerSubmitHandler: (fn: ((text: string) => void) | null) => void;
  submitOnStart: (text: string) => void;
  submitLoading: boolean;
  setSubmitLoading: (v: boolean) => void;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  hydrateMemory: (patch: {
    draft?: string;
    pendingTask?: string | null;
    activeTaskId?: string | null;
  }) => void;
};

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useRef(false);
  const [draft, setDraftState] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [pendingTask, setPendingTaskState] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null);
  const focusRef = useRef<(() => void) | null>(null);
  const submitRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (hydrated.current) return;
    const saved = readSessionMemory();
    if (saved.draft) setDraftState(saved.draft);
    if (saved.pendingTask) setPendingTaskState(saved.pendingTask);
    if (saved.activeTaskId) setActiveTaskIdState(saved.activeTaskId);
    hydrated.current = true;
  }, []);

  const persist = useCallback(
    (patch: {
      draft?: string;
      pendingTask?: string | null;
      activeTaskId?: string | null;
    }) => {
      writeSessionMemory(patch);
    },
    []
  );

  const setDraft = useCallback(
    (v: string) => {
      setDraftState(v);
      persist({ draft: v });
    },
    [persist]
  );

  const setPendingTask = useCallback(
    (v: string | null) => {
      setPendingTaskState(v);
      persist({ pendingTask: v });
    },
    [persist]
  );

  const setActiveTaskId = useCallback(
    (id: string | null) => {
      setActiveTaskIdState(id);
      persist({ activeTaskId: id });
    },
    [persist]
  );

  const hydrateMemory = useCallback(
    (patch: {
      draft?: string;
      pendingTask?: string | null;
      activeTaskId?: string | null;
    }) => {
      if (patch.draft !== undefined) setDraftState(patch.draft);
      if (patch.pendingTask !== undefined) setPendingTaskState(patch.pendingTask);
      if (patch.activeTaskId !== undefined) setActiveTaskIdState(patch.activeTaskId);
      persist(patch);
    },
    [persist]
  );

  const registerFocus = useCallback((fn: () => void) => {
    focusRef.current = fn;
  }, []);

  const focusBar = useCallback(() => {
    focusRef.current?.();
  }, []);

  const submitFromHome = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setPendingTask(text.trim());
      setDraft(text.trim());
      setTransitioning(true);
      setTimeout(() => {
        router.push(`/mission?mission=${encodeURIComponent(text.trim())}&from=home`);
        setTransitioning(false);
      }, 380);
    },
    [router, setPendingTask, setDraft]
  );

  const clearPendingTask = useCallback(
    () => setPendingTask(null),
    [setPendingTask]
  );

  const registerSubmitHandler = useCallback((fn: ((text: string) => void) | null) => {
    submitRef.current = fn;
  }, []);

  const submitOnStart = useCallback((text: string) => {
    submitRef.current?.(text);
  }, []);

  return (
    <CommandContext.Provider
      value={{
        draft,
        setDraft,
        focusBar,
        registerFocus,
        submitFromHome,
        transitioning,
        pendingTask,
        clearPendingTask,
        registerSubmitHandler,
        submitOnStart,
        submitLoading,
        setSubmitLoading,
        activeTaskId,
        setActiveTaskId,
        hydrateMemory,
      }}
    >
      <div
        className={
          transitioning && pathname === "/"
            ? "animate-resolve-exit pointer-events-none"
            : ""
        }
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}
