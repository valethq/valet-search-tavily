import type { Role } from "@valethq/sdk";
import type { Provider } from "./types";

export interface ProviderConfig {
  /** Secret name holding the API key (file ~/.valet/secrets/<name>, then the env var <NAME>). */
  secret?: string;
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
  secret: string;
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

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Math.trunc(n), lo), hi);

export function settings(cfg: ProviderConfig | undefined, p: Provider): Settings {
  const mode = cfg?.mode ?? p.defaultMode;
  return {
    secret: cfg?.secret ?? p.secret,
    baseUrl: (cfg?.baseUrl ?? p.baseUrl).replace(/\/+$/, ""),
    mode: p.modes.includes(mode) ? mode : p.defaultMode,
    numResults: clamp(cfg?.numResults ?? 8, 1, p.maxResults),
    maxCharacters: clamp(cfg?.maxCharacters ?? 2000, 100, MAX_CHARACTERS),
    timeoutMs: clamp(cfg?.timeoutMs ?? 30_000, 1000, 300_000),
    minRole: cfg?.minRole ?? "trusted",
  };
}
