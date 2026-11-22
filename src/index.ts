import { allowedTools, definePlugin } from "@valethq/sdk";
import { type ProviderConfig, settings } from "./config";
import { makeHttp } from "./http";
import { provider } from "./provider";
import { fetchTool, searchTool } from "./tools";

export default definePlugin<ProviderConfig>({
  activate(ctx) {
    let current = settings(ctx.config, provider);
    const http = makeHttp({
      provider,
      baseUrl: () => current.baseUrl,
      secret: () => provider.secret,
      key: async () => current.apiKey,
    });
    if (!current.apiKey) ctx.log.warn("no API key yet; tools will report it until one is added");
    ctx.onConfigChange((next) => {
      current = settings(next, provider);
    });
    const deps = { provider, http, settings: () => current, acl: ctx };
    const tools = [searchTool(deps), fetchTool(deps)];
    ctx.scopes.provide("tools", {
      list: (scope) => allowedTools(ctx, scope, tools),
    });
    ctx.log.info(`${provider.id} search ready`, { minRole: current.minRole });
  },
});
