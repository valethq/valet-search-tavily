import type { AclContext, Decision, PermissionDef, PolicyProvider, Role, ToolCall } from "@valethq/sdk";
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

export const PERMISSION = `search-${provider.id}:query`;

const DECLARED: PermissionDef = { summary: "Run web searches", default: "guest" };

export function fakeAcl(
  opts: { policy?: PolicyProvider["check"]; roles?: Record<string, Role>; declared?: boolean } = {},
): AclContext {
  const roles = opts.roles ?? {};
  const policy: PolicyProvider | undefined = opts.policy && { check: opts.policy };
  return {
    plugin: { id: `valet-search-${provider.id}` },
    acl: {
      permission: (name: string) => (opts.declared === false || name !== PERMISSION ? undefined : DECLARED),
      credential: () => undefined,
    },
    scopes: { maybe: () => policy },
    store: {
      principals: { get: (id: string) => (roles[id] ? { id, role: roles[id] } : undefined) },
      sessions: { get: (id: string) => ({ id, projectId: "p" }) },
    },
    log: { debug() {}, info() {}, warn() {}, error() {} },
  } as unknown as AclContext;
}

export function deps(
  http: Http,
  cfg: Parameters<typeof settings>[0] = {},
  acl: AclContext = fakeAcl(),
): ToolDeps {
  const s = settings(cfg, provider);
  return { provider, http, settings: () => s, acl };
}

export const deny: Decision = { allow: false, by: "policy", reason: "no search for you" };

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
