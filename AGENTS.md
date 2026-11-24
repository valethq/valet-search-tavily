# valet-search-tavily

tools@1 web_search_tavily and web_fetch_tavily tools backed by the Tavily API.

Rules for this repo. The contract lives in `../valet-core`.

- Runtime: Bun 1.4.4 (`~/.npm-global/bin/bun`). Strict TypeScript.
- Contract: `../valet-core/docs/ARCHITECTURE.md` is normative. Read it and the SDK types in `../valet-core/packages/sdk/src/*.ts` before coding. Do not guess signatures. Don't edit the spec unless the human tells you to. You may read `../valet-core/packages/core/src/**` to understand behaviour, but never import it.
- Imports: only `@valethq/sdk`, this plugin's own dependencies, and `node:*` / `bun:*`. Never import `@valethq/core`, another plugin, or any `../valet-*` path.
- Scope types: the SDK declares `inference`, `tools`, `platform`, `identity` and `context`; import those from `@valethq/sdk`. A scope the SDK does not declare is redeclared with module augmentation (`declare module "@valethq/sdk" { interface ValetScopes { ... } }`), copied from the architecture doc.
- No private APIs: no `ctx.internal`, no core-only hooks, no bypass flags. Everything goes through the `PluginContext` passed to `activate`.
- Dependencies: avoid runtime dependencies. Add one only when it is the point of the plugin or the plugin cannot reasonably work without it. Pin exact versions. Dev tooling (typescript, `@types/bun`, `@biomejs/biome`) is fine.
- Checks, all green before you finish: `bun run typecheck`, `bun run lint` (auto-fix with `bunx biome check --write .`), `bun test`.
- Keep the existing `package.json` scripts, `tsconfig.json` and `biome.json`.
- Small files named after what they hold. Minimal comments. No dead code. Add a one-line `// spec-gap:` comment where the spec is silent.
- Git: commit when the work is finished and the checks pass, unless it is extremely large, breaking or unfinished. Don't push unless asked. Author and committer rules are in `../AGENTS.md`.
- Finish with a short summary of what you built and the results of each check.
- Tests live in `test/`: `shared.test.ts` (errors, key, roles), `panel.test.ts` (API key view panel) and `provider.test.ts` (request and response mapping) drive the tools against an injected fake `fetch`; `kernel.test.ts` boots the real kernel with a local fake Tavily server (`plugins.valet-search-tavily.config.baseUrl`) and the API key in `<home>/secrets/tavily_api_key`. Never hit the real Tavily API in tests.
