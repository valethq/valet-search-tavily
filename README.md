# valet-search-tavily

`tools@1` provider with two tools backed by [Tavily](https://tavily.com): `web_search_tavily` and
`web_fetch_tavily`. No runtime dependencies, just `fetch`. Available to `trusted` and `owner` runs by default
(ARCHITECTURE decision 5: friends get search and fetch); `guest` runs get nothing.

## Setup

Put the API key (`tvly-...`) in `~/.valet/secrets/tavily_api_key` (mode 0600) or set `TAVILY_API_KEY` for valet.
The key is read on every call, so adding or rotating it needs no restart. Without one, the tools return an error
that says so.

## Tools

`web_search_tavily { query, numResults?, includeDomains?, excludeDomains?, recency?, topic?, contents?, maxCharacters? }`

- `POST /search`. `recency` is `day | week | month | year` and becomes `time_range`.
- `topic`: `general` (default), `news` or `finance`.
- `contents`: `highlights` (default, Tavily's relevant snippets) or `text` (cleaned page text).
- Returns numbered results: title, URL, date when Tavily has one, excerpt.

`web_fetch_tavily { urls, maxCharacters? }`

- `POST /extract` for up to 10 URLs, as markdown. URLs Tavily could not fetch are listed after the results.

## Config

All optional, under `plugins.valet-search-tavily.config`:

- `secret`: secret name (default `tavily_api_key`)
- `baseUrl`: default `https://api.tavily.com`
- `mode`: Tavily `search_depth`: `basic` (default), `advanced` (2 credits), `fast` or `ultra-fast`
- `numResults`: default 8, max 20
- `maxCharacters`: per-result excerpt size, default 2000 (`web_fetch_tavily` uses 4x)
- `timeoutMs`: default 30000
- `minRole`: lowest role served, default `trusted`

Config changes apply without a restart.

## Settings panel

The plugin adds a settings panel (mode, results per search, excerpt size, timeout, lowest role with access) and shows
whether the API key was found. Values saved there override `config.json` and apply to the next call. "Reset to
config.json" discards them. The key itself is a secret file and is not editable from the panel.

## Checks

`bun run typecheck`, `bun run lint`, `bun test`.
