import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("packages the Worker and public assets for Cloudflare deployment", async () => {
  const configUrl = new URL("../dist/server/wrangler.json", import.meta.url);
  const config = JSON.parse(await readFile(configUrl, "utf8"));

  assert.equal(config.name, "liist");
  assert.equal(config.main, "index.js");
  assert.equal(config.no_bundle, true);
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.assets.directory, "../client");
  assert.equal(config.images.binding, "IMAGES");
  assert.equal(config.workers_dev, true);
  assert.equal(config.observability.enabled, true);
  assert.equal(Object.keys(config.vars ?? {}).length, 0);

  await access(new URL(config.main, configUrl));
  await access(new URL(`${config.assets.directory}/assets/app.js`, configUrl));
  const assets = await readdir(new URL(`${config.assets.directory}/assets/`, configUrl));
  assert.ok(assets.some((name) => name.endsWith(".css")));
});
