/**
 * Redacted release evidence. Values of secrets are never printed.
 */
import { execSync } from "child_process";
import { readdirSync } from "fs";

function sha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const secretNames = [
  "DATABASE_URL",
  "SHADOW_DATABASE_URL",
  "AUTH_SECRET",
  "ADMIN_SESSION_SECRET",
  "AIRWALLEX_CLIENT_ID",
  "AIRWALLEX_API_KEY",
  "AIRWALLEX_WEBHOOK_SECRET",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
];

const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const evidence = {
  testedSha: sha(),
  deploymentSha: process.env.DEPLOYMENT_SHA?.trim() || "",
  nodeEnv: process.env.NODE_ENV || "",
  migrations,
  switches: {
    publicPagesLive: process.env.PUBLIC_PAGES_LIVE === "true",
  },
  providerEnvPresent: Object.fromEntries(secretNames.map((name) => [name, Boolean(process.env[name]?.trim())])),
};
console.log(JSON.stringify(evidence, null, 2));
