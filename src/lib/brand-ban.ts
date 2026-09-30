import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const TEXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"]);

/** Retired wordmark, built so this file does not contain the banned phrase. */
function retiredName() {
  return ["Influence", "Connect"].join(" ");
}

function retiredDomain() {
  return ["influenceconnect", "com"].join(".");
}

export function bannedBrandHit(text: string): string | null {
  const lower = text.toLowerCase();
  const name = retiredName().toLowerCase();
  const domain = retiredDomain().toLowerCase();
  if (lower.includes(name)) return retiredName();
  if (lower.includes(domain)) return retiredDomain();
  return null;
}

export function findBannedBrand(root: string): { file: string; hit: string }[] {
  const hits: { file: string; hit: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const full = path.join(dir, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        walk(full);
        continue;
      }
      if (!TEXT.has(path.extname(name))) continue;
      const hit = bannedBrandHit(readFileSync(full, "utf8"));
      if (hit) hits.push({ file: full, hit });
    }
  };
  walk(root);
  return hits;
}
