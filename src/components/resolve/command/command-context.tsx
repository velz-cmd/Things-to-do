"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

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
};

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const focusRef = useRef<(() => void) | null>(null);
  const submitRef = useRef<((text: string) => void) | null>(null);

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
        router.push(`/start?task=${encodeURIComponent(text.trim())}&from=home`);
        setTransitioning(false);
      }, 380);
    },
    [router]
  );

  const clearPendingTask = useCallback(() => setPendingTask(null), []);

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
