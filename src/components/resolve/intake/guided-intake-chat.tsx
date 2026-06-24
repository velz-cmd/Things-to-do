"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import {
  buildIntakeSummary,
  recommendedAction,
  stepsForRole,
  type IntakeAnswers,
  type IntakeStep,
} from "@/lib/intake/guided-flow";

type ChatMessage = { id: string; role: "assistant" | "user"; content: string };

type GuidedIntakeChatProps = {
  onComplete?: (answers: IntakeAnswers) => void;
  compact?: boolean;
};

export function GuidedIntakeChat({ onComplete, compact }: GuidedIntakeChatProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [done, setDone] = useState(false);
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const booted = useRef(false);

  const steps = stepsForRole(answers.role);
  const currentStep = steps[stepIndex] as IntakeStep | undefined;

  const pushAssistant = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}-${prev.length}`, role: "assistant", content },
    ]);
  }, []);

  const pushUser = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}-${prev.length}`, role: "user", content },
    ]);
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const first = stepsForRole(undefined)[0];
    if (first && "question" in first) {
      pushAssistant(
        "Welcome to RESOLVE. I'll ask a few questions to configure payouts, proof rules, and treasury — all in one place.\n\n" +
          first.question,
      );
    }
  }, [pushAssistant]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const finishIntake = useCallback(
    (finalAnswers: IntakeAnswers) => {
      const action = recommendedAction(finalAnswers);
      const summary = buildIntakeSummary(finalAnswers);
      pushAssistant(
        `Your plan is ready.\n\n${summary}\n\nRecommended: ${action.label}\n${action.detail}`,
      );
      setDone(true);
      onComplete?.(finalAnswers);
    },
    [onComplete, pushAssistant],
  );

  const goToStep = useCallback(
    (nextIndex: number, nextAnswers: IntakeAnswers) => {
      const nextSteps = stepsForRole(nextAnswers.role);
      if (nextIndex >= nextSteps.length) return;

      const next = nextSteps[nextIndex];
      if (next.id === "summary") {
        setStepIndex(nextIndex);
        finishIntake(nextAnswers);
        return;
      }

      setStepIndex(nextIndex);
      if ("question" in next) pushAssistant(next.question);
    },
    [finishIntake, pushAssistant],
  );

  const handleSingleSelect = useCallback(
    (optionId: string, optionLabel: string) => {
      if (!currentStep || currentStep.id === "summary" || !("field" in currentStep)) return;

      pushUser(optionLabel);
      const field = currentStep.field;
      const nextAnswers: IntakeAnswers = { ...answers, [field]: optionId };

      if (field === "role") {
        setAnswers(nextAnswers);
        goToStep(1, nextAnswers);
        return;
      }

      setAnswers(nextAnswers);
      goToStep(stepIndex + 1, nextAnswers);
    },
    [answers, currentStep, goToStep, pushUser, stepIndex],
  );

  const toggleMulti = (optionId: string) => {
    setMultiDraft((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
    );
  };

  const confirmMulti = () => {
    if (!currentStep || !("field" in currentStep) || !currentStep.multi) return;
    if (multiDraft.length === 0) return;

    const labels =
      currentStep.options?.filter((o) => multiDraft.includes(o.id)).map((o) => o.label) ?? [];
    pushUser(labels.join(", "));

    const nextAnswers: IntakeAnswers = {
      ...answers,
      [currentStep.field]: multiDraft,
    };
    setAnswers(nextAnswers);
    setMultiDraft([]);
    goToStep(stepIndex + 1, nextAnswers);
  };

  const handleLaunch = () => {
    router.push(recommendedAction(answers).href);
  };

  const chips =
    currentStep && "options" in currentStep && !done ? currentStep.options : [];

  return (
    <Panel className={compact ? "overflow-hidden" : ""}>
      <div className="flex items-center gap-2 border-b border-resolve-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-resolve-accent" />
        <div>
          <p className="text-sm font-medium text-white">Guided setup</p>
          <p className="text-xs text-resolve-muted">
            Step-by-step intake — we configure your mission control, not open-ended chat.
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[280px] overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-resolve-accent text-white"
                  : "border border-resolve-border bg-resolve-raised text-white"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {!done && chips.length > 0 && (
        <div className="border-t border-resolve-border px-4 py-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const selected = multiDraft.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    currentStep && "multi" in currentStep && currentStep.multi
                      ? toggleMulti(chip.id)
                      : handleSingleSelect(chip.id, chip.label)
                  }
                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    selected
                      ? "border-resolve-accent bg-resolve-accent/15 text-resolve-accent"
                      : "border-resolve-border bg-resolve-bg text-white hover:border-resolve-accent/50"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          {currentStep && "multi" in currentStep && currentStep.multi && (
            <button
              type="button"
              disabled={multiDraft.length === 0}
              onClick={confirmMulti}
              className="inline-flex items-center rounded-md bg-resolve-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Continue
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="border-t border-resolve-border px-4 py-3">
          <button
            type="button"
            onClick={handleLaunch}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-resolve-accent py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Open mission workspace
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </Panel>
  );
}
