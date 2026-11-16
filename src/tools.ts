import type { ToolCall, ToolDefinition, ToolResult } from "@valethq/sdk";
import { MAX_CHARACTERS, MAX_URLS, RANK, type Settings } from "./config";
import { formatHits } from "./format";
import { ProviderError } from "./http";
import type { Http, Provider, Recency } from "./types";

export interface ToolDeps {
  provider: Provider;
  http: Http;
  settings(): Settings;
}

interface SearchInput extends Record<string, unknown> {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  recency?: Recency;
  maxCharacters?: number;
}

interface FetchInput {
  urls: string[];
  maxCharacters?: number;
}

const RECENCY = ["day", "week", "month", "year"];

const text = (t: string, isError = false, meta?: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: t }],
  ...(isError && { isError }),
  ...(meta && { meta }),
});

const cap = (n: number | undefined, fallback: number, max: number) =>
  Math.min(Math.max(Math.trunc(n ?? fallback), 1), max);

function strings(v: unknown): string[] | undefined {
  const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  return list.length > 0 ? list : undefined;
}

function guarded(
  deps: ToolDeps,
  def: Omit<ToolDefinition<never>, "invoke" | "minRole">,
  run: ToolDefinition["invoke"],
): ToolDefinition {
  return {
    ...def,
    get minRole() {
      return deps.settings().minRole;
    },
    async invoke(input, call) {
      if (RANK[call.role] < RANK[deps.settings().minRole]) {
        return text("web search is not available to this role", true);
      }
      try {
        return await run(input, call);
      } catch (e) {
        if (e instanceof ProviderError) return text(e.message, true);
        throw e;
      }
    },
  };
}

const withTimeout = (call: ToolCall, ms: number) => AbortSignal.any([call.signal, AbortSignal.timeout(ms)]);

export function searchTool(deps: ToolDeps): ToolDefinition {
  const { provider } = deps;
  return guarded(
    deps,
    {
      name: `web_search_${provider.id}`,
      description: `Search the web with ${provider.label} and return titles, URLs and page excerpts. Use web_fetch_${provider.id} to read a specific URL in full.`,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for. Natural language works." },
          numResults: { type: "integer", minimum: 1, maximum: provider.maxResults },
          includeDomains: {
            type: "array",
            items: { type: "string" },
            description: "Only these domains, e.g. github.com.",
          },
          excludeDomains: { type: "array", items: { type: "string" } },
          recency: { type: "string", enum: RECENCY, description: "Only pages published within this window." },
          maxCharacters: {
            type: "integer",
            minimum: 100,
            maximum: MAX_CHARACTERS,
            description: "Per-result excerpt size.",
          },
          ...provider.searchProps,
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    async (raw, call) => {
      const input = raw as SearchInput;
      const s = deps.settings();
      if (typeof input.query !== "string" || input.query.trim() === "")
        return text("query is required", true);
      const max = cap(input.maxCharacters, s.maxCharacters, MAX_CHARACTERS);
      const res = await provider.search(
        {
          query: input.query,
          numResults: cap(input.numResults, s.numResults, provider.maxResults),
          includeDomains: strings(input.includeDomains),
          excludeDomains: strings(input.excludeDomains),
          recency: RECENCY.includes(input.recency as string) ? input.recency : undefined,
          maxCharacters: max,
          mode: s.mode,
          input,
          signal: withTimeout(call, s.timeoutMs),
        },
        deps.http,
      );
      return text(formatHits(res.hits, max), false, { results: res.hits.length, cost: res.cost });
    },
  );
}

export function fetchTool(deps: ToolDeps): ToolDefinition {
  const { provider } = deps;
  return guarded(
    deps,
    {
      name: `web_fetch_${provider.id}`,
      description: `Fetch one or more web pages through ${provider.label} and return their text. Use after web_search_${provider.id}, or for any URL you already have.`,
      inputSchema: {
        type: "object",
        properties: {
          urls: { type: "array", items: { type: "string" }, minItems: 1, maxItems: MAX_URLS },
          maxCharacters: {
            type: "integer",
            minimum: 100,
            maximum: MAX_CHARACTERS,
            description: "Per-page cap.",
          },
        },
        required: ["urls"],
        additionalProperties: false,
      },
    },
    async (raw, call) => {
      const input = raw as FetchInput;
      const s = deps.settings();
      const urls = strings(input.urls)?.slice(0, MAX_URLS);
      if (!urls) return text("urls is required", true);
      const max = cap(input.maxCharacters, s.maxCharacters * 4, MAX_CHARACTERS);
      const res = await provider.fetch(
        { urls, maxCharacters: max, signal: withTimeout(call, s.timeoutMs) },
        deps.http,
      );
      const out = res.hits.length > 0 ? formatHits(res.hits, max) : "";
      const note = res.failed.length > 0 ? `\n\nCould not fetch:\n${res.failed.join("\n")}` : "";
      if (!out && !note) return text("No content returned.", true);
      return text(`${out}${note}`.trim(), res.hits.length === 0, { results: res.hits.length });
    },
  );
}
