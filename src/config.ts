import type { Role } from "@valethq/sdk";
import type { Provider } from "./types";

export interface ProviderConfig {
  /** The API key, resolved by core from its `${secret:...}` ref. */
  apiKey?: string;
  baseUrl?: string;
  /** Provider search mode; the allowed values are in manifest.json. */
  mode?: string;
  /** Default result count. Default 8. */
  numResults?: number;
  /** Default characters of excerpt or page text per result. Default 2000. */
  maxCharacters?: number;
  /** Request timeout. Default 30000. */
  timeoutMs?: number;
  /** Lowest role that gets the tools. Default "trusted" (ARCHITECTURE decision 5: friends get search and fetch). */
  minRole?: Role;
}

export interface Settings {
  apiKey?: string;
  baseUrl: string;
  mode: string;
  numResults: number;
  maxCharacters: number;
  timeoutMs: number;
  minRole: Role;
}

export const RANK: Record<Role, number> = { guest: 0, trusted: 1, owner: 2 };
export const MAX_URLS = 10;
export const MAX_CHARACTERS = 50_000;
export const MIN_CHARACTERS = 100;
export const MIN_TIMEOUT_MS = 1000;
export const MAX_TIMEOUT_MS = 300_000;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Math.trunc(n), lo), hi);

export function settings(cfg: ProviderConfig | undefined, p: Provider): Settings {
  const mode = cfg?.mode ?? p.defaultMode;
  return {
    ...(cfg?.apiKey ? { apiKey: cfg.apiKey } : {}),
    baseUrl: (cfg?.baseUrl ?? p.baseUrl).replace(/\/+$/, ""),
    mode: p.modes.includes(mode) ? mode : p.defaultMode,
    numResults: clamp(cfg?.numResults ?? 8, 1, p.maxResults),
    maxCharacters: clamp(cfg?.maxCharacters ?? 2000, MIN_CHARACTERS, MAX_CHARACTERS),
    timeoutMs: clamp(cfg?.timeoutMs ?? 30_000, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    minRole: cfg?.minRole ?? "trusted",
  };
}
