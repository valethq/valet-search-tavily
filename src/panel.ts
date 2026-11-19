import type { SettingsBlock, SettingsPanel } from "@valethq/sdk";
import type { Settings } from "./config";
import type { Provider } from "./types";

export interface PanelDeps {
  provider: Provider;
  current(): Settings;
  hasKey(): Promise<boolean>;
}

/** Live key status above the config form. Editable values live in configSchema (12.1). */
export function settingsPanel(d: PanelDeps): SettingsPanel {
  const { provider } = d;
  return {
    title: `${provider.label} API key`,
    description: `Whether the API key secret is present. Edit search settings in the form below.`,
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
            { type: "button", label: "Refresh", action: "refresh" },
          ],
        },
      ];
    },
    refreshMs: 15_000,
    actions: {
      refresh: () => {},
    },
  };
}
