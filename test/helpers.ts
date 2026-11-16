import type { PluginStorage, ToolCall } from "@valethq/sdk";
import { settings } from "../src/config";
import { makeHttp } from "../src/http";
import { provider } from "../src/provider";
import type { ToolDeps } from "../src/tools";
import type { Http } from "../src/types";

export interface Seen {
  path: string;
  body: Record<string, unknown>;
  headers: Headers;
}

export function fakeApi(reply: (path: string) => unknown, key: string | null = "k-123") {
  const seen: Seen[] = [];
  const client: Http = makeHttp({
    provider,
    baseUrl: () => "http://api.test",
    secret: () => provider.secret,
    key: async () => key ?? undefined,
    fetch: async (input, init) => {
      const path = new URL(input).pathname;
      seen.push({
        path,
        body: JSON.parse(String(init.body)),
        headers: new Headers(init.headers),
      });
      const r = reply(path);
      return r instanceof Response ? r : Response.json(r);
    },
  });
  return { client, seen };
}

export function deps(http: Http, cfg: Parameters<typeof settings>[0] = {}): ToolDeps {
  const s = settings(cfg, provider);
  return { provider, http, settings: () => s };
}

export const call = (role: ToolCall["role"] = "trusted"): ToolCall => ({
  sessionId: "s",
  runId: "r",
  callId: "c",
  role,
  caller: { plugin: "valet-agent" } as ToolCall["caller"],
  cwd: "/",
  signal: new AbortController().signal,
  progress() {},
});

export const textOf = (r: { content: { type: string; text?: string }[] }) =>
  r.content.map((c) => c.text ?? "").join("");

export function kv(): PluginStorage["kv"] {
  const map = new Map<string, unknown>();
  return {
    get: <T>(k: string) => map.get(k) as T | undefined,
    set: (k, v) => void map.set(k, v),
    delete: (k) => void map.delete(k),
    list: (p = "") => [...map.keys()].filter((k) => k.startsWith(p)),
  };
}
