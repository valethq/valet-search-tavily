import { expect, test } from "bun:test";
import { fetchTool, searchTool } from "../src/tools";
import { call, deps, fakeApi, textOf } from "./helpers";

const hit = {
  title: "Bun 1.4",
  url: "https://bun.sh/blog",
  content: "fast runtime",
  published_date: "2026-10-01",
};

test("web_search_tavily sends a bearer key, maps options to Tavily's body and formats results", async () => {
  const { client, seen } = fakeApi(() => ({ results: [hit] }));
  const r = await searchTool(deps(client)).invoke(
    {
      query: "bun release",
      numResults: 3,
      includeDomains: ["bun.sh"],
      excludeDomains: ["x.com"],
      recency: "week",
      topic: "news",
    },
    call(),
  );
  expect(r.isError).toBeUndefined();
  expect(textOf(r)).toBe("[1] Bun 1.4\nhttps://bun.sh/blog\n2026-10-01\nfast runtime");
  const [s] = seen;
  expect(s?.path).toBe("/search");
  expect(s?.headers.get("authorization")).toBe("Bearer k-123");
  expect(s?.body).toEqual({
    query: "bun release",
    search_depth: "basic",
    max_results: 3,
    chunks_per_source: 3,
    include_domains: ["bun.sh"],
    exclude_domains: ["x.com"],
    time_range: "week",
    topic: "news",
  });
});

test("web_search_tavily clamps to 20 results, asks for page text on demand and skips chunks in ultra-fast", async () => {
  const { client, seen } = fakeApi(() => ({
    results: [{ url: "https://a.b", content: "snippet", raw_content: "full page" }],
  }));
  const text = await searchTool(deps(client)).invoke(
    { query: "x", numResults: 99, contents: "text", topic: "bogus" },
    call(),
  );
  expect(textOf(text)).toBe("[1] https://a.b\nhttps://a.b\nfull page");
  expect(seen[0]?.body).toMatchObject({ max_results: 20, include_raw_content: "markdown" });
  expect(seen[0]?.body.topic).toBeUndefined();
  await searchTool(deps(client, { mode: "ultra-fast" })).invoke({ query: "x" }, call());
  expect(seen[1]?.body).toMatchObject({ search_depth: "ultra-fast" });
  expect(seen[1]?.body.chunks_per_source).toBeUndefined();
});

test("web_search_tavily truncates long excerpts and survives an empty reply", async () => {
  const { client } = fakeApi(() => ({ results: [{ url: "https://a.b", content: "x".repeat(5000) }] }));
  const out = textOf(await searchTool(deps(client)).invoke({ query: "q", maxCharacters: 300 }, call()));
  expect(out.endsWith("...")).toBe(true);
  expect(out.length).toBeLessThan(400);
  const empty = fakeApi(() => ({}));
  expect(textOf(await searchTool(deps(empty.client)).invoke({ query: "q" }, call()))).toBe("No results.");
});

test("web_fetch_tavily posts urls to /extract and reports failed_results", async () => {
  const { client, seen } = fakeApi(() => ({
    results: [{ url: "https://a.test", raw_content: "hello" }],
    failed_results: [{ url: "https://b.test", error: "Failed to fetch url" }],
  }));
  const r = await fetchTool(deps(client)).invoke({ urls: ["https://a.test", "https://b.test"] }, call());
  expect(r.isError).toBeUndefined();
  expect(textOf(r)).toBe(
    "[1] https://a.test\nhttps://a.test\nhello\n\nCould not fetch:\nhttps://b.test: Failed to fetch url",
  );
  expect(seen[0]?.path).toBe("/extract");
  expect(seen[0]?.body).toEqual({
    urls: ["https://a.test", "https://b.test"],
    extract_depth: "basic",
    format: "markdown",
  });
});

test("web_fetch_tavily is an error when nothing comes back", async () => {
  const { client } = fakeApi(() => ({
    results: [],
    failed_results: [{ url: "https://b.test", error: "blocked" }],
  }));
  const r = await fetchTool(deps(client)).invoke({ urls: ["https://b.test"] }, call());
  expect(r.isError).toBe(true);
  expect(textOf(r)).toContain("https://b.test: blocked");
  expect((await fetchTool(deps(client)).invoke({ urls: [] }, call())).isError).toBe(true);
});
