import type { PluginStorage, Role, SettingsBlock, SettingsPanel } from "@valethq/sdk";
import {
  MAX_CHARACTERS,
  MAX_TIMEOUT_MS,
  MIN_CHARACTERS,
  MIN_TIMEOUT_MS,
  type ProviderConfig,
  RANK,
  type Settings,
  settings,
} from "./config";
import type { Provider } from "./types";

type Kv = PluginStorage["kv"];

const KEYS = ["mode", "numResults", "maxCharacters", "timeoutMs", "minRole"] as const;

/** Values saved from the settings panel; they win over config.json so the UI works without a restart. */
function overrides(kv: Kv): ProviderConfig {
  const out: Record<string, unknown> = {};
  for (const k of KEYS) {
    const v = kv.get<unknown>(k);
    if (v !== undefined) out[k] = v;
  }
  return out as ProviderConfig;
}

export function resolve(config: ProviderConfig | undefined, kv: Kv, provider: Provider): Settings {
  return settings({ ...config, ...overrides(kv) }, provider);
}

const int = (v: unknown, name: string, lo: number, hi: number): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) {
    throw new Error(`${name} must be a whole number from ${lo} to ${hi}`);
  }
  return v;
};

function validate(
  v: Record<string, unknown>,
  provider: Provider,
): Partial<Record<(typeof KEYS)[number], unknown>> {
  const out: Partial<Record<(typeof KEYS)[number], unknown>> = {};
  if (v.mode !== undefined) {
    if (typeof v.mode !== "string" || !provider.modes.includes(v.mode)) {
      throw new Error(`mode must be one of: ${provider.modes.join(", ")}`);
    }
    out.mode = v.mode;
  }
  if (v.numResults !== undefined) out.numResults = int(v.numResults, "numResults", 1, provider.maxResults);
  if (v.maxCharacters !== undefined)
    out.maxCharacters = int(v.maxCharacters, "maxCharacters", MIN_CHARACTERS, MAX_CHARACTERS);
  if (v.timeoutMs !== undefined)
    out.timeoutMs = int(v.timeoutMs, "timeoutMs", MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  if (v.minRole !== undefined) {
    if (typeof v.minRole !== "string" || !(v.minRole in RANK))
      throw new Error("minRole must be owner, trusted or guest");
    out.minRole = v.minRole as Role;
  }
  return out;
}

export interface PanelDeps {
  provider: Provider;
  kv: Kv;
  current(): Settings;
  /** Re-resolves settings after the panel changed the stored values. */
  apply(): void;
  hasKey(): Promise<boolean>;
}

export function settingsPanel(d: PanelDeps): SettingsPanel {
  const { provider } = d;
  return {
    title: `${provider.label} search`,
    description: `Overrides this plugin's config.json block; applies to the next call. The API key is a secret file, not a setting.`,
    schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          title: "Mode",
          enum: provider.modes,
          description: `${provider.label}'s search mode or depth.`,
        },
        numResults: {
          type: "integer",
          title: "Results per search",
          minimum: 1,
          maximum: provider.maxResults,
        },
        maxCharacters: {
          type: "integer",
          title: "Excerpt characters",
          description: "Per result. web_fetch uses four times this.",
          minimum: MIN_CHARACTERS,
          maximum: MAX_CHARACTERS,
        },
        timeoutMs: {
          type: "integer",
          title: "Timeout (ms)",
          minimum: MIN_TIMEOUT_MS,
          maximum: MAX_TIMEOUT_MS,
        },
        minRole: {
          type: "string",
          title: "Lowest role with access",
          enum: ["owner", "trusted", "guest"],
          enumNames: ["Owner only", "Trusted and owner", "Everyone"],
        },
      },
    },
    get: () => {
      const s = d.current();
      return {
        mode: s.mode,
        numResults: s.numResults,
        maxCharacters: s.maxCharacters,
        timeoutMs: s.timeoutMs,
        minRole: s.minRole,
      };
    },
    set: (v) => {
      const next = validate(v, provider);
      for (const [k, val] of Object.entries(next)) d.kv.set(k, val);
      d.apply();
    },
    view: async (): Promise<SettingsBlock[]> => {
      const secret = d.current().secret;
      const found = await d.hasKey();
      return [
        {
          type: "group",
          layout: "row",
          blocks: [
            {
              type: "badge",
              text: found ? "API key found" : "No API key",
              tone: found ? "good" : "critical",
            },
            { type: "text", text: `~/.valet/secrets/${secret} or ${secret.toUpperCase()}` },
          ],
        },
        {
          type: "button",
          label: "Reset to config.json",
          action: "reset",
          confirm: "Discard values saved from this panel?",
        },
      ];
    },
    refreshMs: 15_000,
    actions: {
      reset: () => {
        for (const k of KEYS) d.kv.delete(k);
        d.apply();
      },
    },
  };
}
