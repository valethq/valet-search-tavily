import type { Hit, Provider } from "./types";

interface TavilyResult {
  title?: string | null;
  url: string;
  content?: string;
  raw_content?: string | null;
  published_date?: string | null;
}

interface SearchResponse {
  results?: TavilyResult[];
}

interface ExtractResponse {
  results?: { url: string; raw_content?: string | null }[];
  failed_results?: { url: string; error?: string }[];
}

const TOPICS = ["general", "news", "finance"];
const CHUNK_CHARS = 500;

export const provider: Provider = {
  id: "tavily",
  label: "Tavily",
  secret: "tavily_api_key",
  baseUrl: "https://api.tavily.com",
  modes: ["basic", "advanced", "fast", "ultra-fast"],
  defaultMode: "basic",
  maxResults: 20,
  searchProps: {
    topic: { type: "string", enum: TOPICS, description: "news for current events, finance for markets." },
    contents: {
      type: "string",
      enum: ["highlights", "text"],
      description: "Relevant snippets per result (default), or the cleaned page text.",
    },
  },
  headers: (key) => ({ authorization: `Bearer ${key}` }),
  async search(req, http) {
    const { topic, contents = "highlights" } = req.input;
    const body: Record<string, unknown> = {
      query: req.query,
      search_depth: req.mode,
      max_results: req.numResults,
    };
    if (req.mode !== "ultra-fast") {
      body.chunks_per_source = Math.min(Math.max(Math.ceil(req.maxCharacters / CHUNK_CHARS), 1), 3);
    }
    if (req.includeDomains) body.include_domains = req.includeDomains;
    if (req.excludeDomains) body.exclude_domains = req.excludeDomains;
    if (req.recency) body.time_range = req.recency;
    if (typeof topic === "string" && TOPICS.includes(topic)) body.topic = topic;
    if (contents === "text") body.include_raw_content = "markdown";
    const res = (await http.post("/search", body, req.signal)) as SearchResponse;
    const hits: Hit[] = (res.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      date: r.published_date,
      text: contents === "text" ? r.raw_content || r.content : r.content,
    }));
    return { hits };
  },
  async fetch(req, http) {
    const res = (await http.post(
      "/extract",
      { urls: req.urls, extract_depth: "basic", format: "markdown" },
      req.signal,
    )) as ExtractResponse;
    return {
      hits: (res.results ?? []).map((r) => ({ url: r.url, text: r.raw_content ?? undefined })),
      failed: (res.failed_results ?? []).map((f) => `${f.url}: ${f.error ?? "error"}`),
    };
  },
};
