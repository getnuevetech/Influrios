import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  countryRouteReview,
  feeRuleReview,
  normalizePaymentSettingsSection,
  paymentSettingsHref,
  visiblePaymentSettingsSections,
} from "@/app/admin/payment-settings/owner";
import type { AdminModule } from "@/lib/admin-auth";

describe("payment settings owner", () => {
  it("uses one Payment settings entry and the T12 sections", () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    assert.match(layout, /label: "Payment settings"/);
    assert.equal(layout.includes('href: "/admin/fees"'), false);
    assert.equal(layout.includes('href: "/admin/corridors"'), false);
    assert.equal(layout.includes('href: "/admin/gateways"'), false);
    assert.equal(layout.includes('href: "/admin/payment-switches"'), false);
    const owner = readFileSync("src/app/admin/payment-settings/owner.ts", "utf8");
    assert.match(owner, /label: "Providers"/);
    assert.match(owner, /label: "Country routes"/);
    assert.match(owner, /label: "Fees & policies"/);
    const page = readFileSync("src/app/admin/payment-settings/page.tsx", "utf8");
    assert.match(page, /AdminGatewaysPanel/);
    assert.match(page, /CountryRoutesPanel/);
    assert.match(page, /AdminFeesPanel/);
    assert.match(page, /PaymentSwitchesPanel/);
    assert.match(page, /AdminCorridorsPanel/);
    assert.match(page, /ReviewBeforeSave/);
    assert.match(page, /Add country route/);
    assert.match(readFileSync("src/components/review-before-save.tsx", "utf8"), /kind === "country-route"|countryRouteReview/);
  });

  it("keeps old payment admin paths on the matching section", () => {
    assert.equal(normalizePaymentSettingsSection("gateways"), "providers");
    assert.equal(normalizePaymentSettingsSection("corridors"), "routes");
    assert.equal(normalizePaymentSettingsSection("switches"), "fees");
    assert.equal(normalizePaymentSettingsSection("billing"), undefined);
    assert.equal(
      paymentSettingsHref("fees", { saved: "rule", section: "routes" }, "payment-switches"),
      "/admin/payment-settings?section=fees&saved=rule#payment-switches",
    );
    const commerceOnly = (module: AdminModule) => module === "commerce";
    assert.deepEqual(visiblePaymentSettingsSections(commerceOnly), ["fees"]);
  });

  it("reviews the route and the fee rule before they are saved", () => {
    const route = new FormData();
    route.set("countryCode", "US");
    route.set("currency", "USD");
    route.set("collectionProviderCode", "airwallex");
    route.set("holdingProviderCode", "");
    route.set("payoutGatewayCode", "stripe");
    const reviewed = countryRouteReview(route);
    assert.equal(reviewed.title, "Review country route");
    assert.match(reviewed.heading, /US/);
    assert.equal(reviewed.checks.find((row) => row.label.startsWith("Collection"))?.value, "Configured");
    assert.equal(reviewed.checks.find((row) => row.label.startsWith("Holding"))?.value, "Not configured");
    assert.match(reviewed.note, /does not move money/);

    const fee = new FormData();
    fee.set("name", "Activation");
    fee.set("purpose", "business_platform_fee");
    fee.set("payer", "brand");
    fee.set("jurisdiction", "US");
    fee.set("method", "percent");
    const preview = feeRuleReview(fee);
    assert.equal(preview.title, "Fee rule and impact preview");
    assert.match(preview.note, /signed snapshots remain unchanged/);
    assert.equal(preview.lines.find((row) => row.label === "Country")?.value, "US");
  });
});
