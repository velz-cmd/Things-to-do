import OpenAI from "openai";
import { getQwenApiKey, getQwenBaseUrl } from "./config";
import type { QwenModelId } from "./models";

export type QwenChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type QwenStreamChunk =
  | { type: "reasoning"; text: string }
  | { type: "content"; text: string }
  | { type: "done" };

let cachedClient: OpenAI | null = null;

function getQwenOpenAIClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = getQwenApiKey();
    if (!apiKey) throw new Error("DASHSCOPE_API_KEY is not configured");
    cachedClient = new OpenAI({
      apiKey,
      baseURL: getQwenBaseUrl(),
    });
  }
  return cachedClient;
}

/** Stream Qwen chat with optional DashScope deep-thinking (`reasoning_content`). */
export async function* streamQwenChat(input: {
  model: QwenModelId;
  messages: QwenChatMessage[];
  enableThinking?: boolean;
}): AsyncGenerator<QwenStreamChunk> {
  const client = getQwenOpenAIClient();
  const completion = await client.chat.completions.create({
    model: input.model,
    messages: input.messages,
    stream: true,
    ...(input.enableThinking ? { enable_thinking: true } : {}),
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

  for await (const chunk of completion) {
    if (!chunk.choices?.length) continue;
    const delta = chunk.choices[0].delta as {
      content?: string | null;
      reasoning_content?: string | null;
    };

    if (delta.reasoning_content) {
      yield { type: "reasoning", text: delta.reasoning_content };
    }
    if (delta.content) {
      yield { type: "content", text: delta.content };
    }
  }

  yield { type: "done" };
}

export async function completeQwenChat(input: {
  model: QwenModelId;
  messages: QwenChatMessage[];
  enableThinking?: boolean;
}): Promise<{ reasoning: string; content: string }> {
  let reasoning = "";
  let content = "";
  for await (const chunk of streamQwenChat(input)) {
    if (chunk.type === "reasoning") reasoning += chunk.text;
    if (chunk.type === "content") content += chunk.text;
  }
  return { reasoning, content };
}
