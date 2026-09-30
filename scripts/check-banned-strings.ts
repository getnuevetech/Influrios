import { findBannedBrand } from "../src/lib/brand-ban";

const hits = findBannedBrand("src");
if (hits.length) {
  for (const hit of hits) console.error(`${hit.file}: ${hit.hit}`);
  process.exit(1);
}
console.log("Application code does not contain the retired brand.");
