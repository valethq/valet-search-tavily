import { definePlugin } from "@valethq/sdk";
import { type ProviderConfig, RANK } from "./config";
import { makeHttp } from "./http";
import { resolve, settingsPanel } from "./panel";
import { provider } from "./provider";
import { fetchTool, searchTool } from "./tools";

export default definePlugin<ProviderConfig>({
  async activate(ctx) {
    let config = ctx.config;
    let current = resolve(config, ctx.storage.kv, provider);
    const apply = () => {
      current = resolve(config, ctx.storage.kv, provider);
    };
    const http = makeHttp({
      provider,
      baseUrl: () => current.baseUrl,
      secret: () => current.secret,
      key: () => ctx.secrets.get(current.secret),
    });
    if (!(await ctx.secrets.get(current.secret))) {
      ctx.log.warn("no API key yet; tools will report it until one is added", { secret: current.secret });
    }
    ctx.onConfigChange((next) => {
      config = next;
      apply();
    });
    const deps = { provider, http, settings: () => current };
    const tools = [searchTool(deps), fetchTool(deps)];
    ctx.scopes.provide("tools", {
      list: ({ role }) => (RANK[role] >= RANK[current.minRole] ? tools : []),
    });
    ctx.scopes.define({ name: "settings", version: 1, cardinality: "many" });
    ctx.scopes.provide(
      "settings",
      settingsPanel({
        provider,
        kv: ctx.storage.kv,
        current: () => current,
        apply,
        hasKey: async () => Boolean(await ctx.secrets.get(current.secret)),
      }),
      { key: ctx.plugin.id },
    );
    ctx.log.info(`${provider.id} search ready`, { minRole: current.minRole });
  },
});
