import { definePlugin, type InferenceChunk, type ModelProvider } from "@valethq/sdk";

// A scripted model: a "[valet-exec]" notification is acknowledged; a user message holding {"tool":..., "input":...} becomes that tool call; a tool result is echoed back.
const provider: ModelProvider = {
  kind: "model",
  id: "fixture-model",
  label: "Fixture model",
  listModels: async () => [
    {
      id: "m1",
      name: "m1",
      contextWindow: 100_000,
      maxOutputTokens: 1000,
      input: ["text"],
      reasoning: false,
    },
  ],
  async *stream(req): AsyncIterable<InferenceChunk> {
    const last = req.messages.at(-1);
    const text = last?.content.map((c) => (c.type === "text" ? c.text : "")).join("") ?? "";
    if (last?.role === "tool") {
      yield { type: "text-delta", text: `tool said: ${text}` };
      yield { type: "finish", reason: "stop" };
      return;
    }
    if (text.startsWith("[valet-exec]")) {
      yield { type: "text-delta", text: `notified: ${text.split("\n")[0]}` };
      yield { type: "finish", reason: "stop" };
      return;
    }
    const json = text.slice(text.indexOf("{"));
    const call = JSON.parse(json) as { tool: string; input: unknown };
    yield { type: "tool-call", callId: `c${Date.now()}`, name: call.tool, input: call.input };
    yield { type: "finish", reason: "tool-calls" };
  },
};

export default definePlugin({
  activate(ctx) {
    ctx.scopes.provide("inference", provider, { key: provider.id });
  },
});
