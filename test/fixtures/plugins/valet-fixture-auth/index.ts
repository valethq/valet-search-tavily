import { definePlugin } from "@valethq/sdk";

export default definePlugin<{ token: string }>({
  async activate(ctx) {
    const principal = ctx.store.principals.resolveIdentity("fixture", "owner", { displayName: "Owner" });
    await ctx.store.principals.setRole(principal.id, "owner");
    ctx.scopes.provide("identity", {
      authenticate: (req) =>
        req.headers.get("authorization") === `Bearer ${ctx.config.token}`
          ? { principalId: principal.id }
          : undefined,
    });
  },
});
