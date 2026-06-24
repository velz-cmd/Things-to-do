/** Alibaba Model Studio / DashScope Qwen models (OpenAI-compatible endpoint). */
export const QWEN_MODELS = {
  /** Fast responses — escalation copy, lightweight classification */
  flash: "qwen3.6-flash",
  /** Balanced planner with deep thinking */
  plus: "qwen-plus-2025-12-01",
  /** Maximum reasoning for complex mission planning */
  max: "qwen3.6-max-preview",
} as const;

export type QwenModelId = (typeof QWEN_MODELS)[keyof typeof QWEN_MODELS];

export const QWEN_DEFAULT_BASE_URL =
  "https://ws-yn23kv194w5nn7tx.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";

export function qwenPlannerModels(): QwenModelId[] {
  const primary =
    (process.env.QWEN_PLANNER_MODEL as QwenModelId | undefined) ?? QWEN_MODELS.plus;
  const fallbacks: QwenModelId[] = [QWEN_MODELS.max, QWEN_MODELS.flash];
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

export function qwenFastModel(): QwenModelId {
  return (process.env.QWEN_FAST_MODEL as QwenModelId | undefined) ?? QWEN_MODELS.flash;
}

export function qwenReasoningModel(): QwenModelId {
  return (
    (process.env.QWEN_REASONING_MODEL as QwenModelId | undefined) ?? QWEN_MODELS.max
  );
}
