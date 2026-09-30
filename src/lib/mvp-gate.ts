import { readFileSync } from "node:fs";
import { decideGuestGate } from "@/lib/account-policy";
import { transitionCollaboration } from "@/lib/collaborations";
import { DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_MENUS } from "@/lib/directory";
import { cardChrome, decideCount, PLAN_ENTITLEMENTS } from "@/lib/entitlements";
import { INVITATION_STATUSES } from "@/lib/invitations";
import { nextJobStatus } from "@/lib/jobs";
import { mailConfigFromEnv } from "@/lib/mail";
import { advanceClaimStage } from "@/lib/onboarding";
import { AI_FUNCTIONS, assessGateway, DEFAULT_PAYMENT_ROUTES, routeAiFunction } from "@/lib/providers";
import { filterCreators, type SeedCreator } from "@/lib/seed-data";
import { canonicalSpecialty } from "@/lib/taxonomy";
import { webhookDisposition } from "@/lib/webhook-idempotency";

export type GateItem = {
  id: number;
  name: string;
  check: () => string | null;
};

const woodworker: SeedCreator = {
  slug: "ada",
  displayName: "Ada",
  title: "Maker",
  bio: "Builds rooms",
  locationCity: "Austin",
  locationCountry: "USA",
  languages: ["English"],
  avatarColor: "#111",
  image: "/ada.jpg",
  badge: "Rising Star",
  statusLabel: "Open",
  planTier: "STARTER",
  specialties: ["woodworking"],
  socials: [],
  openToCollab: true,
  verified: true,
};

/** Section 33 of the product spec, checked against the code that shipped in phases A–H. */
export const SECTION_33: GateItem[] = [
  {
    id: 1,
    name: "CMS sections and menu",
    check: () => {
      const keys = DEFAULT_HOMEPAGE_SECTIONS.map((section) => section.key);
      if (!keys.includes("hero") || !keys.includes("value_proposition") || !keys.includes("card_promo")) {
        return "Homepage sections are missing hero, value proposition, or the card promo.";
      }
      const header = DEFAULT_MENUS.filter((item) => item.menu === "header").map((item) => item.href);
      if (!header.includes("/") || !header.includes("/discover") || !header.includes("/collaboration")) {
        return "The header menu is missing Home, Discover, or Collaboration.";
      }
      return null;
    },
  },
  {
    id: 2,
    name: "Taxonomy drives search",
    check: () => {
      const synonyms = [{ term: "woodwork", slug: "woodworking" }];
      if (canonicalSpecialty("woodwork", synonyms) !== "woodworking") return "A synonym did not resolve to its specialty.";
      const found = filterCreators([woodworker], { q: "woodwork" }, synonyms);
      if (found.length !== 1) return "Search did not match the synonym to a creator.";
      return null;
    },
  },
  {
    id: 3,
    name: "Invite and claim states",
    check: () => {
      if (!INVITATION_STATUSES.includes("queued") || !INVITATION_STATUSES.includes("published")) {
        return "Invitation statuses are missing queued or published.";
      }
      const claimed = advanceClaimStage("draft", "claim");
      const verified = claimed.ok ? advanceClaimStage(claimed.stage, "verify") : claimed;
      const published = verified.ok ? advanceClaimStage(verified.stage, "publish") : verified;
      if (!published.ok || published.stage !== "published") return "Claim does not walk draft to published.";
      if (advanceClaimStage("draft", "publish").ok) return "A draft can publish before verification.";
      return null;
    },
  },
  {
    id: 4,
    name: "Collaboration states",
    check: () => {
      if (!transitionCollaboration("draft", "sent").ok) return "A draft proposal cannot be sent.";
      if (!transitionCollaboration("sent", "accepted").ok) return "A sent proposal cannot be accepted.";
      if (transitionCollaboration("accepted", "declined").ok) return "An accepted proposal can still be declined.";
      return null;
    },
  },
  {
    id: 5,
    name: "Guest policy",
    check: () => {
      if (decideGuestGate(3, { soft: 3, hard: 5 }, false) !== "soft") return "The guest soft limit did not prompt.";
      if (decideGuestGate(5, { soft: 3, hard: 5 }, false) !== "hard") return "The guest hard limit did not block.";
      if (decideGuestGate(9, { soft: 3, hard: 5 }, true) !== "allow") return "A signed-in visitor was blocked by the guest gate.";
      return null;
    },
  },
  {
    id: 6,
    name: "Card URL and QR by entitlement",
    check: () => {
      const starter = cardChrome(PLAN_ENTITLEMENTS.STARTER);
      const plus = cardChrome(PLAN_ENTITLEMENTS.PLUS);
      const pro = cardChrome(PLAN_ENTITLEMENTS.PRO);
      if (starter.showQr || starter.showShortlink) return "Starter shows a QR or a short link.";
      if (!plus.showQr || !plus.showShortlink || plus.gold) return "Plus does not show a short link and a standard QR without gold.";
      if (!pro.dynamicQr || !pro.gold) return "Pro does not show a dynamic QR and the full theme.";
      return null;
    },
  },
  {
    id: 7,
    name: "Plan limits enforced by feature key",
    check: () => {
      const decision = decideCount(PLAN_ENTITLEMENTS.STARTER, "specialtiesMax", 2, "STARTER");
      if (decision.ok) return "A second Starter specialty was allowed.";
      if (decision.feature !== "card.specialties.max") return "The specialty limit did not name its feature key.";
      return null;
    },
  },
  {
    id: 8,
    name: "Payment provider registry",
    check: () => {
      const stripe = DEFAULT_PAYMENT_ROUTES.find((route) => route.countryCode === "US");
      if (stripe?.gateway !== "stripe") return "The United States route is not Stripe.";
      const ready = assessGateway({
        countryCode: "US",
        providerCode: "stripe",
        providerName: "Stripe",
        routeActive: true,
        providerEnabled: true,
        hasSecret: true,
      });
      const disabled = assessGateway({
        countryCode: "US",
        providerCode: "stripe",
        routeActive: true,
        providerEnabled: false,
        hasSecret: true,
      });
      if (!ready.ready || disabled.ready) return "The gateway registry did not follow the enabled secret.";
      return null;
    },
  },
  {
    id: 9,
    name: "AI function with fallback",
    check: () => {
      const keys = AI_FUNCTIONS.map((fn) => fn.key);
      if (!keys.includes("profile_topic_classification") || !keys.includes("collaboration_match_explanation")) {
        return "The classification or match-explanation function is missing.";
      }
      const decision = routeAiFunction({ functionKey: "profile_topic_classification" });
      if (decision.mode !== "fallback") return "An unassigned AI function did not use the fallback.";
      return null;
    },
  },
  {
    id: 10,
    name: "SMTP stays inactive until configured",
    check: () => (mailConfigFromEnv({}) ? "SMTP was treated as configured with an empty environment." : null),
  },
  {
    id: 11,
    name: "Audit log",
    check: () =>
      /model AuditLog \{/.test(readFileSync("prisma/schema.prisma", "utf8")) ? null : "AuditLog is missing from the schema.",
  },
  {
    id: 12,
    name: "Failed jobs can be retried",
    check: () => {
      if (nextJobStatus(3, false) !== "failed" || nextJobStatus(1, false) !== "queued") {
        return "Job attempts did not fail at three.";
      }
      const page = readFileSync("src/app/admin/jobs/page.tsx", "utf8");
      if (!page.includes("Retry")) return "The jobs page has no retry control.";
      return null;
    },
  },
];

export function section33Failures(): string[] {
  return SECTION_33.flatMap((item) => {
    const problem = item.check();
    return problem ? [`${item.id}. ${item.name}: ${problem}`] : [];
  });
}

export function webhookRepeatsAreSkipped(): boolean {
  return webhookDisposition({ duplicate: true, eventType: "checkout.session.completed" }) === "skip";
}
