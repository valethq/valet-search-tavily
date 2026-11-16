// The only provider-specific test data besides provider.test.ts.
export const ok = { results: [{ title: "T", url: "https://a.test", content: "h" }] };

export const kernel = {
  searchPath: "/search",
  fetchPath: "/extract",
  /** Header the API key travels in, and its expected value for the key "kernel-key". */
  authHeader: "authorization",
  authValue: "Bearer kernel-key",
  reply: { results: [{ title: "Hit", url: "https://example.test/a", content: "found it" }] },
  output: "[1] Hit\nhttps://example.test/a\nfound it",
};
