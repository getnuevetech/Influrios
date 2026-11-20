/**
 * Build route-inventory.csv + action-inventory.csv from source pages + prior visual-audit routes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const DOCS = "/cursor/stores/self/docs/e2e-audit";
const APP = "/workspace/src/app";

function walkPages(dir, base = "") {
  const out = [];
  const entries = execSync(`find ${JSON.stringify(dir)} -type f -name page.tsx`, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const f of entries) {
    let rel = f.replace(dir, "").replace(/\/page\.tsx$/, "");
    if (rel === "") rel = "/";
    // Next.js dynamic
    const route = rel.replace(/\[([^\]]+)\]/g, ":$1");
    out.push({ sourcePath: f, route });
  }
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

function roleFor(route) {
  if (route.startsWith("/admin")) return "admin";
  if (route.startsWith("/agency")) return "agency";
  if (route.startsWith("/business")) return "business";
  if (route.startsWith("/creator") || route.startsWith("/dashboard")) return "influencer";
  if (route.startsWith("/collaboration")) return "member"; // business or influencer
  if (route.startsWith("/api")) return "api";
  return "public";
}

function journeyFor(route) {
  if (route.includes("login") || route.includes("signup") || route.includes("register") || route.includes("reset") || route.includes("claim") || route.includes("verify")) return "J01-J02";
  if (route.includes("pricing") || route.includes("billing") || route.includes("plans")) return "J16-J18";
  if (route.includes("payment") || route.includes("earning") || route.includes("marketplace") || route.includes("checkout")) return "J13-J15";
  if (route.includes("contract") || route.includes("signing")) return "J10-J12";
  if (route.includes("request") || route.includes("inbox") || route.includes("invite") || route.includes("propose") || route.includes("opening") || route.includes("application")) return "J04-J06";
  if (route.includes("message") || route.includes("notification")) return "J22-J23";
  if (route.includes("admin")) return "J25-J28";
  if (route.includes("discover") || route.includes("card") || route.includes("creator") || route.includes("dashboard") || route.includes("profile")) return "J03";
  if (route.includes("agency")) return "AGENCY-DEFERRED";
  return "J29";
}

function presentationFor(route) {
  if (route.includes("request") || route.includes("contract") || route.includes("tax") || route.includes("plan")) {
    return "list+centered-popup (expected per PR #533)";
  }
  if (route.startsWith("/admin")) return "admin-shell";
  if (route.startsWith("/business") || route.startsWith("/creator") || route.startsWith("/dashboard") || route.startsWith("/collaboration") || route.startsWith("/account")) {
    return "account-shell";
  }
  return "public-marketing";
}

async function main() {
  await fs.mkdir(DOCS, { recursive: true });
  const pages = walkPages(APP);
  const rows = pages.map((p) => {
    const role = roleFor(p.route);
    const deferred = role === "agency";
    return {
      route: p.route,
      role,
      journeyId: journeyFor(p.route),
      screenIdentity: p.route,
      expectedPresentation: presentationFor(p.route),
      source: p.sourcePath.replace("/workspace/", ""),
      status: deferred ? "deferred-agency" : role === "api" ? "api" : "implemented",
      verification: "pending",
    };
  });

  const header =
    "route,role,journeyId,screenIdentity,expectedPresentation,source,status,verification\n";
  const csv =
    header +
    rows
      .map((r) =>
        [r.route, r.role, r.journeyId, r.screenIdentity, r.expectedPresentation, r.source, r.status, r.verification]
          .map((c) => `"${String(c).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n") +
    "\n";
  await fs.writeFile(path.join(DOCS, "route-inventory.csv"), csv);

  // Action inventory — seed from known CTAs / families; runner will enrich
  const actions = [
    ["A-PUBLIC-SIGNUP", "public", "/signup", "Submit signup", "J01", "pending"],
    ["A-PUBLIC-LOGIN", "public", "/login", "Submit login", "J02", "pending"],
    ["A-PUBLIC-RESET", "public", "/account/reset", "Request password reset", "J02", "blocked-mail-sink"],
    ["A-INF-PUBLISH", "influencer", "/dashboard", "Publish/unpublish profile", "J03", "pending"],
    ["A-BIZ-NEW-REQUEST", "business", "/collaboration/business", "New request popup", "J04", "blocked-isolation"],
    ["A-BIZ-EDIT-REQUEST", "business", "/collaboration/business", "Edit request popup", "J04", "blocked-isolation"],
    ["A-BIZ-PUBLISH-REQUEST", "business", "/collaboration/business", "Publish request", "J04", "blocked-isolation"],
    ["A-BIZ-INVITE", "business", "/collaboration/business", "Invite influencer", "J05", "blocked-mail-sink"],
    ["A-INF-ACCEPT-INVITE", "influencer", "/collaboration/inbox", "Accept invitation", "J05", "blocked-isolation"],
    ["A-INF-DECLINE-INVITE", "influencer", "/collaboration/inbox", "Decline invitation", "J05", "blocked-isolation"],
    ["A-BIZ-SELECT-CANDIDATE", "business", "/collaboration/business", "Select candidate / view responses", "J06", "blocked-isolation"],
    ["A-BIZ-DELETE-REQUEST", "business", "/collaboration/business", "Delete draft/pending request", "J07", "blocked-isolation"],
    ["A-BIZ-WITHDRAW", "business", "/collaboration/business", "Withdraw accepted participant", "J08", "blocked-isolation"],
    ["A-PROTECTED-DELETE", "business", "/collaboration/contracts", "Attempt delete signed/funded", "J09", "blocked-isolation"],
    ["A-AGREEMENT-PREPARE", "business", "/collaboration/contracts", "Prepare agreement", "J10", "blocked-isolation"],
    ["A-SIGN-BUSINESS", "business", "/collaboration/contracts/:id", "Sign agreement", "J11", "blocked-isolation"],
    ["A-SIGN-INFLUENCER", "influencer", "/collaboration/contracts/:id", "Sign agreement", "J11", "blocked-isolation"],
    ["A-FUND-CHECKOUT", "business", "/payments/checkout/:id", "Sandbox funding checkout", "J13", "blocked-isolation"],
    ["A-MILESTONE-SUBMIT", "influencer", "/collaboration/work/:fundingId", "Submit deliverable", "J14", "blocked-isolation"],
    ["A-MILESTONE-REVISE", "business", "/collaboration/work/:fundingId", "Request revision", "J14", "blocked-isolation"],
    ["A-MILESTONE-APPROVE", "business", "/collaboration/work/:fundingId", "Approve milestone", "J14", "blocked-isolation"],
    ["A-PAYOUT-RELEASE", "admin", "/admin/marketplace", "Release/payout sandbox", "J15", "blocked-isolation"],
    ["A-SUB-CHECKOUT-MONTHLY", "member", "/pricing|/billing", "Purchase monthly sandbox", "J16", "blocked-isolation"],
    ["A-SUB-CHECKOUT-ANNUAL", "member", "/pricing|/billing", "Purchase annual sandbox", "J16", "blocked-isolation"],
    ["A-SUB-CHANGE", "member", "/billing", "Change plan interval", "J17", "blocked-isolation"],
    ["A-DISCOUNT-APPLY", "member", "/billing", "Apply annual discount code", "J18", "blocked-isolation"],
    ["A-ADMIN-TAX-EDIT", "admin", "/admin/payment-settings?section=tax", "Edit tax rule popup", "J19", "blocked-isolation"],
    ["A-MSG-SEND", "member", "/creator/messages|/collaboration", "Send message + attachment", "J22", "blocked-isolation"],
    ["A-ADMIN-ACCOUNT-EDIT", "admin", "/admin/accounts", "Edit account popup", "J25", "read-only-inspect"],
    ["A-ADMIN-PLAN-EDIT", "admin", "/admin/plans", "Edit plan/entitlement", "J26", "blocked-isolation"],
    ["A-ADMIN-CMS", "admin", "/admin/homepage", "CMS edit/preview", "J27", "read-only-inspect"],
    ["A-ADMIN-JOB-RETRY", "admin", "/admin/jobs", "Retry failed job", "J27", "blocked-isolation"],
    ["A-AI-ENTRY", "admin", "/admin/ai|/admin/matching", "AI/matching entry points", "J28", "read-only-inspect"],
    ["A-AGENCY-UPGRADE", "business", "/business/billing", "Agency upgrade CTA dead-end inventory", "AGENCY", "deferred"],
  ];

  const aHeader = "actionId,role,route,action,journeyId,mappingStatus\n";
  const aCsv =
    aHeader +
    actions
      .map((a) => a.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n") +
    "\n";
  await fs.writeFile(path.join(DOCS, "action-inventory.csv"), aCsv);

  console.log(JSON.stringify({ routes: rows.length, actions: actions.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
