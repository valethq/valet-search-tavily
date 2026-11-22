import { expect, test } from "bun:test";
import { provider } from "../src/provider";
import { fetchTool, searchTool } from "../src/tools";
import { ok } from "./fixture";
import manifest from "../manifest.json";
import { PERMISSION, call, deny, deps, fakeAcl, fakeApi, textOf } from "./helpers";

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

test("the query permission is declared for guests and carried by both tools", () => {
  const name = PERMISSION.slice(PERMISSION.indexOf(":") + 1);
  expect(PERMISSION).toBe(`search-${provider.id}:query`);
  expect(manifest.acl.permissions[name as "query"]).toEqual({
    summary: `Run web searches with ${provider.label}`,
    default: "guest",
  });
  const { client } = fakeApi(() => ok);
  expect(searchTool(deps(client)).permission).toBe(PERMISSION);
  expect(fetchTool(deps(client)).permission).toBe(PERMISSION);
});

test("a policy provider can withhold the permission", async () => {
  const { client, seen } = fakeApi(() => ok);
  const acl = fakeAcl({ policy: (_s, permission) => (permission === PERMISSION ? deny : { allow: true }) });
  for (const tool of [searchTool(deps(client, {}, acl)), fetchTool(deps(client, {}, acl))]) {
    const r = await tool.invoke({ query: "q", urls: ["https://a.test"] }, call("owner"));
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("no search for you");
  }
  expect(seen).toHaveLength(0);
});

test("the permission is allowed at its guest default when the role floor allows", async () => {
  const { client, seen } = fakeApi(() => ok);
  const r = await searchTool(deps(client, { minRole: "guest" })).invoke({ query: "q" }, call("guest"));
  expect(r.isError).toBeUndefined();
  expect(seen).toHaveLength(1);
});

test("an undeclared permission is denied", async () => {
  const { client } = fakeApi(() => ok);
  const r = await searchTool(deps(client, {}, fakeAcl({ declared: false }))).invoke(
    { query: "q" },
    call("owner"),
  );
  expect(r.isError).toBe(true);
});
