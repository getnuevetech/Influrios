import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meiliConfigFromEnv, meiliConfigFromRow } from "./search-settings";

describe("Meilisearch settings", () => {
  it("uses the environment host", () => {
    const config = meiliConfigFromEnv({ MEILI_HOST: "http://meili:7700/", MEILI_API_KEY: "env-key" } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(config, { host: "http://meili:7700", apiKey: "env-key" });
  });

  it("uses an enabled admin row when the environment host is empty", () => {
    assert.equal(meiliConfigFromEnv({} as unknown as NodeJS.ProcessEnv), null);
    const config = meiliConfigFromRow({ enabled: true, host: "https://search.example/", apiKey: "saved" });
    assert.deepEqual(config, { host: "https://search.example", apiKey: "saved" });
  });

  it("ignores a disabled admin row", () => {
    assert.equal(meiliConfigFromRow({ enabled: false, host: "https://search.example", apiKey: "saved" }), null);
  });
});
