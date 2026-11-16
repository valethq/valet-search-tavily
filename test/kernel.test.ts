import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { provider } from "../src/provider";
import { kernel } from "./fixture";

// Boots the real kernel with valet-agent and a scripted model; the provider API is a local fake server.
const CORE = process.env.VALET_CORE_DIR ?? join(import.meta.dir, "..", "..", "valet-core");
const CLI = join(CORE, "packages/core/src/cli.ts");
const VALET = join(import.meta.dir, "..", "..");
const ROOT = join(import.meta.dir, "..");
const AUTH = { authorization: "Bearer tok", "content-type": "application/json" };

// biome-ignore lint/suspicious/noExplicitAny: loose REST shapes in a test
type Json = any;

setDefaultTimeout(40_000);

let home: string;
let base: string;
let proc: Bun.Subprocess | undefined;
let fake: ReturnType<typeof Bun.serve> | undefined;
let sessionId: string;
const requests: { path: string; key: string | null; body: Json }[] = [];
const PLUGIN: string = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")).id;

function shim(id: string, dir: string): void {
  const out = join(home, "plugins", id);
  mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ ...manifest, main: "./index.ts" }));
  writeFileSync(
    join(out, "index.ts"),
    `export { default } from ${JSON.stringify(join(dir, manifest.main))};\n`,
  );
}

async function api(path: string, init: { method?: string; body?: unknown } = {}): Promise<Json> {
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: AUTH,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  return res.json();
}

async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms = 15_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await Bun.sleep(50);
  }
}

async function call(tool: string, input: unknown): Promise<Json> {
  const before: Json[] = await api(`/api/core/sessions/${sessionId}/messages`);
  await api(`/api/core/sessions/${sessionId}/messages`, {
    method: "POST",
    body: { role: "user", parts: [{ type: "text", text: JSON.stringify({ tool, input }) }] },
  });
  return waitFor(async () => {
    const list: Json[] = await api(`/api/core/sessions/${sessionId}/messages`);
    const a = list.slice(before.length).find((m) => m.message.role === "assistant");
    return a && a.message.status !== "streaming" && a.parts.length === 2 && a;
  });
}

beforeAll(async () => {
  fake = Bun.serve({
    port: 0,
    async fetch(req) {
      const body = await req.json();
      requests.push({ path: new URL(req.url).pathname, key: req.headers.get(kernel.authHeader), body });
      return Response.json(kernel.reply);
    },
  });
  home = mkdtempSync(join(tmpdir(), "valet-search-exa-kernel-"));
  const workspace = mkdtempSync(join(tmpdir(), "valet-search-exa-ws-"));
  shim(PLUGIN, ROOT);
  shim("valet-agent", join(VALET, "valet-agent"));
  shim("valet-contextmanager", join(VALET, "valet-contextmanager"));
  mkdirSync(join(home, "secrets"), { recursive: true });
  writeFileSync(join(home, "secrets", provider.secret), "kernel-key\n", { mode: 0o600 });
  const probe = Bun.serve({ port: 0, fetch: () => new Response("") });
  const port = probe.port as number;
  await probe.stop(true);
  base = `http://127.0.0.1:${port}`;
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      server: { port },
      pluginPaths: [join(import.meta.dir, "fixtures", "plugins"), join(home, "plugins")],
      plugins: {
        "valet-fixture-auth": { config: { token: "tok" } },
        [PLUGIN]: { config: { baseUrl: `http://127.0.0.1:${fake.port}` } },
      },
    }),
  );
  proc = Bun.spawn(["bun", CLI, "start", "--home", home], {
    stdout: Bun.file(join(home, "out.log")),
    stderr: Bun.file(join(home, "err.log")),
  });
  await waitFor(async () => (await fetch(`${base}/`)).status === 200);
  const project = await api("/api/core/projects", {
    method: "POST",
    body: { name: "p", workspaceDir: workspace },
  });
  const session = await api("/api/core/sessions", {
    method: "POST",
    body: { projectId: project.id, settings: { model: { provider: "fixture-model", model: "m1" } } },
  });
  sessionId = session.id;
});

afterAll(async () => {
  proc?.kill("SIGTERM");
  await proc?.exited;
  await fake?.stop(true);
});

test("both tools run through the agent loop with the key from the secrets dir", async () => {
  const plugins: Json = await api("/api/core/plugins");
  const states = Object.fromEntries(
    (Array.isArray(plugins) ? plugins : plugins.plugins).map((p: Json) => [p.id, p.state]),
  );
  expect(states[PLUGIN]).toBe("active");

  const searchName = `web_search_${provider.id}`;
  const search = await call(searchName, { query: "valet plugins", recency: "month" });
  expect(search.parts[0].data).toMatchObject({ name: searchName, status: "done" });
  expect(search.parts[0].data.output).toBe(kernel.output);
  expect(requests[0]).toMatchObject({ path: kernel.searchPath, key: kernel.authValue });

  const fetchName = `web_fetch_${provider.id}`;
  const page = await call(fetchName, { urls: ["https://example.test/a"] });
  expect(page.parts[0].data).toMatchObject({ name: fetchName, status: "done" });
  expect(requests[1]).toMatchObject({ path: kernel.fetchPath });
});
