import { expect, test } from "bun:test";
import { settings } from "../src/config";
import { settingsPanel } from "../src/panel";
import { provider } from "../src/provider";

function setup(config = {}, key = true) {
  const current = settings(config, provider);
  const panel = settingsPanel({
    provider,
    current: () => current,
    hasKey: async () => key,
  });
  return { panel, current };
}

test("the view reports whether a key was found", async () => {
  const found = (await setup({}, true).panel.view?.()) ?? [];
  const missing = (await setup({}, false).panel.view?.()) ?? [];
  expect(JSON.stringify(found)).toContain('"API key found"');
  expect(JSON.stringify(found)).toContain('"tone":"good"');
  expect(JSON.stringify(missing)).toContain('"No API key"');
  expect(JSON.stringify(missing)).toContain('"tone":"critical"');
  expect(JSON.stringify(found)).toContain(`~/.valet/secrets/${provider.secret}`);
  expect(JSON.stringify(found)).toContain('"action":"refresh"');
});

test("refresh is a no-op action the UI can call", async () => {
  const { panel } = setup();
  await Promise.resolve(panel.actions?.refresh?.({}));
});
