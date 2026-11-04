import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { serverEnv } from "./env";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  done: Promise<{ provider: string; model: string; inputTokens: number; outputTokens: number; refused: boolean }>;
}

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

/**
 * Fournisseur IA : Anthropic Claude par défaut, OpenAI en repli si seule
 * cette clé est configurée. Le prompt système stable est mis en cache.
 */
export function streamChat(params: { system: string; context: string; messages: ChatTurn[]; maxTokens?: number }): StreamResult {
  if (serverEnv.anthropicApiKey) return streamAnthropic(params);
  if (serverEnv.openaiApiKey) return streamOpenAI(params);
  throw new Error("L'assistant n'est pas configuré (ANTHROPIC_API_KEY ou OPENAI_API_KEY).");
}

function streamAnthropic({ system, context, messages, maxTokens = 16000 }: Parameters<typeof streamChat>[0]): StreamResult {
  anthropic ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey });
  const model = serverEnv.aiModel;
  const s = anthropic.beta.messages.stream({
    model,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
      { type: "text", text: context },
    ],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const stream = (async function* () {
    for await (const event of s) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  })();

  const done = s.finalMessage().then((msg) => ({
    provider: "anthropic",
    model: msg.model,
    inputTokens: (msg.usage.input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0),
    outputTokens: msg.usage.output_tokens ?? 0,
    refused: msg.stop_reason === "refusal",
  }));
  return { stream, done };
}

function streamOpenAI({ system, context, messages, maxTokens = 8000 }: Parameters<typeof streamChat>[0]): StreamResult {
  openai ??= new OpenAI({ apiKey: serverEnv.openaiApiKey });
  const model = serverEnv.openaiModel;
  let usage = { inputTokens: 0, outputTokens: 0 };
  let resolveDone!: (v: Awaited<StreamResult["done"]>) => void;
  const done = new Promise<Awaited<StreamResult["done"]>>((r) => (resolveDone = r));
  const stream = (async function* () {
    const res = await openai!.chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: maxTokens,
      messages: [{ role: "system", content: `${system}\n\n${context}` }, ...messages],
    });
    for await (const chunk of res) {
      const t = chunk.choices[0]?.delta?.content;
      if (t) yield t;
      if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
    }
    resolveDone({ provider: "openai", model, ...usage, refused: false });
  })();
  return { stream, done };
}
