import { expect, test } from "bun:test";
import { provider } from "../src/provider";
import { searchTool } from "../src/tools";
import { ok } from "./fixture";
import { call, deps, fakeApi, textOf } from "./helpers";

test("HTTP failures become readable tool errors", async () => {
  for (const [status, hint] of [
    [401, "rejected"],
    [402, "credits"],
    [429, "rate limited"],
  ] as const) {
    const { client } = fakeApi(() => new Response("nope", { status }));
    const r = await searchTool(deps(client)).invoke({ query: "q" }, call());
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain(`${provider.label} ${status}`);
    expect(textOf(r)).toContain(hint);
  }
});

test("a missing key explains where to put it", async () => {
  const { client, seen } = fakeApi(() => ok, null);
  const r = await searchTool(deps(client)).invoke({ query: "q" }, call());
  expect(r.isError).toBe(true);
  expect(textOf(r)).toContain(`~/.valet/secrets/${provider.secret}`);
  expect(seen).toHaveLength(0);
});

test("roles below minRole are refused", async () => {
  const { client, seen } = fakeApi(() => ok);
  const t = searchTool(deps(client));
  expect(t.minRole).toBe("trusted");
  expect((await t.invoke({ query: "q" }, call("guest"))).isError).toBe(true);
  expect(seen).toHaveLength(0);
  expect((await t.invoke({ query: "q" }, call("owner"))).isError).toBeUndefined();
  const strict = searchTool(deps(client, { minRole: "owner" }));
  expect((await strict.invoke({ query: "q" }, call("trusted"))).isError).toBe(true);
});
