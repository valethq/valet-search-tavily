import { expect, test } from "bun:test";
import { resolve, settingsPanel } from "../src/panel";
import { provider } from "../src/provider";
import { kv as makeKv } from "./helpers";

function setup(config = {}, key = true) {
  const store = makeKv();
  let current = resolve(config, store, provider);
  const apply = () => {
    current = resolve(config, store, provider);
  };
  const panel = settingsPanel({
    provider,
    kv: store,
    current: () => current,
    apply,
    hasKey: async () => key,
  });
  return { store, panel, now: () => current };
}

test("the panel shows config.json values until something is saved, then its own win", async () => {
  const { panel, now } = setup({ numResults: 5, maxCharacters: 900 });
  expect(await panel.get?.()).toMatchObject({
    numResults: 5,
    maxCharacters: 900,
    mode: provider.defaultMode,
    minRole: "trusted",
  });
  const other = provider.modes.find((m) => m !== provider.defaultMode) as string;
  await panel.set?.({ numResults: 2, mode: other, minRole: "owner" });
  expect(now()).toMatchObject({ numResults: 2, mode: other, minRole: "owner", maxCharacters: 900 });
});

test("invalid values are rejected and nothing is stored", async () => {
  const { panel, store, now } = setup();
  const before = now();
  const bad: Record<string, unknown>[] = [
    { mode: "nope" },
    { numResults: 0 },
    { numResults: provider.maxResults + 1 },
    { numResults: 2.5 },
    { maxCharacters: 10 },
    { timeoutMs: "fast" },
    { minRole: "admin" },
  ];
  for (const v of bad)
    await expect(Promise.resolve().then(() => panel.set?.({ numResults: 3, ...v }))).rejects.toThrow();
  expect(store.list()).toEqual([]);
  expect(now()).toEqual(before);
});

test("reset drops the saved values", async () => {
  const { panel, store, now } = setup({ numResults: 5 });
  await panel.set?.({ numResults: 1, timeoutMs: 5000 });
  expect(now().numResults).toBe(1);
  await panel.actions?.reset?.({});
  expect(store.list()).toEqual([]);
  expect(now()).toMatchObject({ numResults: 5, timeoutMs: 30_000 });
});

test("the view reports whether a key was found", async () => {
  const found = (await setup({}, true).panel.view?.()) ?? [];
  const missing = (await setup({}, false).panel.view?.()) ?? [];
  expect(JSON.stringify(found)).toContain('"API key found"');
  expect(JSON.stringify(found)).toContain('"tone":"good"');
  expect(JSON.stringify(missing)).toContain('"No API key"');
  expect(JSON.stringify(missing)).toContain('"tone":"critical"');
  expect(JSON.stringify(found)).toContain(`~/.valet/secrets/${provider.secret}`);
});
