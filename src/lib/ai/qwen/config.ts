import { QWEN_DEFAULT_BASE_URL } from "./models";

export function isQwenConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY?.trim());
}

export function getQwenApiKey(): string | undefined {
  return process.env.DASHSCOPE_API_KEY?.trim() || undefined;
}

export function getQwenBaseUrl(): string {
  return (
    process.env.QWEN_OPENAI_BASE_URL?.trim() ||
    process.env.QWEN_BASE_URL?.trim() ||
    QWEN_DEFAULT_BASE_URL
  );
}
