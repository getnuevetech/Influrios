/**
 * CMS-backed Collaboration + For Businesses landing pages.
 * Stored on CmsSection payloads (keys: collaboration_landing, business_landing,
 * influencer_identity). Admin-editable without deploy.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type LandingTextItem = { title: string; copy: string };
export type LandingCta = { label: string; href: string };
export type LandingLabeledItem = { label: string; copy?: string };

export type CollaborationLandingConfig = {
  hero: {
    title: string;
    subtitle: string;
    primaryCta: LandingCta;
    secondaryCta: LandingCta;
    searchPlaceholder: string;
    tags: string[];
    collageLabels: string[];
  };
  popularMatches: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
  };
  dualPath: {
    title: string;
    business: { eyebrow: string; title: string; points: string[]; cta: LandingCta };
    influencer: { eyebrow: string; title: string; points: string[]; cta: LandingCta };
  };
  featured: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
  };
  marketplace: {
    businessTitle: string;
    businessSubtitle: string;
    influencerTitle: string;
    influencerSubtitle: string;
  };
  suggestionsBanner: {
    title: string;
    subtitle: string;
    cta: LandingCta;
  };
  howItWorks: {
    title: string;
    steps: string[];
  };
  features: {
    businessTitle: string;
    businessItems: string[];
    influencerTitle: string;
    influencerItems: string[];
  };
  protectedPayments: {
    title: string;
    subtitle: string;
    steps: string[];
  };
  collabTypes: {
    title: string;
    items: string[];
  };
  mentorship: {
    title: string;
    subtitle: string;
    findCta: LandingCta;
    becomeCta: LandingCta;
  };
  trustBar: {
    title: string;
    items: string[];
  };
  finalCtas: {
    influencer: { title: string; points: string[]; cta: LandingCta };
    business: { title: string; points: string[]; cta: LandingCta };
  };
};

export type BusinessLandingConfig = {
  hero: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
    primaryCta: LandingCta;
    secondaryCta: LandingCta;
    searchPlaceholder: string;
    tags: string[];
    collageNote: string;
    floatingNotes: string[];
  };
  capabilities: {
    title: string;
    items: LandingTextItem[];
  };
  recommended: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
  };
  howItWorks: {
    title: string;
    steps: LandingTextItem[];
  };
  whyChoose: {
    title: string;
    items: string[];
    photoCaption: string;
  };
  plans: {
    title: string;
    items: {
      code: string;
      name: string;
      price: string;
      detail: string;
      points: string[];
      ctaLabel: string;
      href: string;
      popular?: boolean;
    }[];
  };
  signup: {
    title: string;
    subtitle: string;
    checkboxLabel: string;
    submitLabel: string;
    asideTitle: string;
    asideCopy: string;
    asideCta: LandingCta;
  };
};

export type InfluencerIdentityConfig = {
  /** Self-description options shown during onboarding (platform role stays Influencer). */
  selfDescriptions: string[];
};

const COLLAB_LANDING_KEY = "collaboration_landing";
const BUSINESS_LANDING_KEY = "business_landing";
const IDENTITY_KEY = "influencer_identity";

export const DEFAULT_COLLABORATION_LANDING: CollaborationLandingConfig = {
  hero: {
    title: "Find the Right Collaboration. Build Bigger Opportunities.",
    subtitle:
      "Connect with influencers, businesses, and complementary professionals. Get smart suggestions, create structured collaborations, and get paid securely through milestone-protected payments.",
    primaryCta: { label: "Explore Collaborations", href: "#matches" },
    secondaryCta: { label: "Get Collaboration Suggestions", href: "/collaboration?goal=awareness" },
    searchPlaceholder: "Search influencers, businesses, niches, location or collaboration opportunities...",
    tags: ["Beauty", "Travel", "Tech", "Food", "Fitness", "Fashion", "Lifestyle"],
    collageLabels: [
      "Brands: Find the right influencers",
      "Influencers: Discover opportunities",
      "Collaborate: Create. Grow. Get Paid.",
    ],
  },
  popularMatches: {
    title: "Popular Collaboration Matches",
    subtitle: "Category pairs saved on this landing.",
    ctaLabel: "View all categories",
    ctaHref: "/categories",
  },
  dualPath: {
    title: "Choose How You Want to Collaborate",
    business: {
      eyebrow: "I'm a Business",
      title: "Work with the Right Influencers",
      points: [
        "Discover influencers by specialty, audience and market",
        "Get smart influencer suggestions for your campaign goals",
        "Post collaboration requests for influencers to apply",
        "Create contracts with clear milestones and deliverables",
        "Fund collaborations securely by milestone",
        "Track campaign performance in one place",
      ],
      cta: { label: "Create Business Profile", href: "/business" },
    },
    influencer: {
      eyebrow: "I'm an Influencer",
      title: "Find Opportunities & Grow",
      points: [
        "Discover brand and influencer collaboration opportunities",
        "Collaborate with other influencers and complementary professionals",
        "Receive invitations and manage proposals in one hub",
        "Get paid securely with milestone protection",
        "Set up payout methods and track earnings",
        "Access influencer mentorship to grow faster",
      ],
      cta: { label: "Join as an Influencer", href: "/claim" },
    },
  },
  featured: {
    title: "Featured Collaboration Matches",
    subtitle: "High-potential pairings based on audience, content fit, and goals.",
    ctaLabel: "View more matches",
    ctaHref: "/collaboration#matches",
  },
  marketplace: {
    businessTitle: "Business Requests",
    businessSubtitle: "Businesses looking for influencers.",
    influencerTitle: "Influencer Collaboration Opportunities",
    influencerSubtitle: "Influencers looking for other influencers, businesses or complementary professionals.",
  },
  suggestionsBanner: {
    title: "Not sure who your business should work with?",
    subtitle: "Tell us your category and campaign goal — get influencer suggestions matched to your brief.",
    cta: { label: "Get Influencer Suggestions", href: "/collaboration?goal=awareness" },
  },
  howItWorks: {
    title: "How Influrios Collaboration Works",
    steps: ["Discover", "Match", "Agree on Terms", "Fund Collaboration", "Complete Milestones", "Release Payment"],
  },
  features: {
    businessTitle: "For Businesses",
    businessItems: [
      "Smart Influencer Suggestions",
      "Post Collaboration Requests",
      "Invite & Contract",
      "Custom Milestones",
      "Fund by Milestones",
      "Campaign Analytics",
      "Multi-influencer Campaigns",
      "Global Reach",
      "Verified Influencers",
    ],
    influencerTitle: "For Influencers",
    influencerItems: [
      "Professional Influencer Profile",
      "Influencer-to-Influencer Collabs",
      "Brand Opportunities",
      "Protected Payments",
      "Milestone Protection",
      "Global Payout Readiness",
      "Saved Matches",
      "Influencer Mentorship",
      "Portfolio & Media Kit",
    ],
  },
  protectedPayments: {
    title: "Protected Collaboration Payments",
    subtitle: "Funds stay protected until milestones are completed and approved.",
    steps: [
      "Business Funds Collaboration",
      "Milestones Completed",
      "Milestones Approved",
      "Payments Released",
      "Platform Commission",
    ],
  },
  collabTypes: {
    title: "Popular Collaboration Types",
    items: [
      "Brand Partnership",
      "Product Review",
      "Content Collab",
      "Influencer-to-Influencer",
      "Event / Experience",
      "Long-term Partnership",
      "Affiliate / Performance",
      "Mentorship Collab",
    ],
  },
  mentorship: {
    title: "Influencer Mentorship",
    subtitle:
      "Emerging influencers learn from experienced influencers. Find an Influencer Mentor or become one.",
    findCta: { label: "Find an Influencer Mentor", href: "/mentorship" },
    becomeCta: { label: "Become an Influrios Influencer Mentor", href: "/mentorship" },
  },
  trustBar: {
    title: "Why Collaborate Through Influrios",
    items: [
      "Verified Influencers",
      "Structured Agreements",
      "Milestone Transparency",
      "Protected Payments",
      "Specialty Fit Matching",
      "Global Reach",
      "Campaign Tracking",
      "Influencer Mentorship",
    ],
  },
  finalCtas: {
    influencer: {
      title: "Join as an Influencer",
      points: [
        "Access influencer collaboration opportunities",
        "Get matched with relevant brands",
        "Grow with your existing social presence",
      ],
      cta: { label: "Join as an Influencer", href: "/claim" },
    },
    business: {
      title: "Create Business Profile",
      points: [
        "Find influencers faster",
        "Post requests and collaboration briefs",
        "Fund deals with protected milestones",
      ],
      cta: { label: "Create Business Profile", href: "/business" },
    },
  },
};

export const DEFAULT_BUSINESS_LANDING: BusinessLandingConfig = {
  hero: {
    eyebrow: "For Businesses & Brands",
    title: "Find the Right Influencers.",
    titleHighlight: "Build Better Collaborations.",
    subtitle:
      "Discover authentic influencers, get AI-powered suggestions, create and manage collaborations with protected payments — all in one place.",
    primaryCta: { label: "Create Business Profile", href: "#create-profile" },
    secondaryCta: { label: "Get Influencer Suggestions", href: "/collaboration?goal=awareness" },
    searchPlaceholder: "Search influencers by specialty, country, platform or audience…",
    tags: ["Beauty", "Travel", "Tech", "Food", "Fitness", "Finance", "Home & Design"],
    collageNote: "Different Influencers. Bigger Possibilities.",
    floatingNotes: [
      "Find Influencers by what they actually influence",
      "Real Collaborations. Real Results.",
    ],
  },
  capabilities: {
    title: "What Your Business Can Do on Influrios",
    items: [
      {
        title: "Discover Influencers",
        copy: "Search and filter by specialty, location, audience, platform, and collaboration fit.",
      },
      {
        title: "Get Smart Suggestions",
        copy: "Tell us your goals and get AI-powered influencer recommendations matched to your brief.",
      },
      {
        title: "Post Collaboration Requests",
        copy: "Share campaign needs and invite influencers who are open to partner.",
      },
      {
        title: "Invite & Contract",
        copy: "Review profiles, discuss terms, and create contracts with clear milestones.",
      },
      {
        title: "Fund by Milestones",
        copy: "Secure payments with milestone-based funding and release when work is approved.",
      },
      {
        title: "Track Campaign Performance",
        copy: "Monitor briefs, shortlists, progress, and results in one business workspace.",
      },
      {
        title: "Work with Multiple Influencers",
        copy: "Run multi-influencer campaigns from a single business account.",
      },
      {
        title: "Global Reach",
        copy: "Coordinate cross-border collaborations with clear commercial workflows.",
      },
    ],
  },
  recommended: {
    title: "Influencers on Influrios",
    subtitle: "Published directory profiles. Open a profile to see what is stored.",
    ctaLabel: "View more influencers",
    ctaHref: "/discover",
  },
  howItWorks: {
    title: "How It Works",
    steps: [
      { title: "Create Business Profile", copy: "Tell us about your business." },
      { title: "Tell Us What You Need", copy: "Post a request or get AI suggestions." },
      { title: "Match & Collaborate", copy: "Review terms and create a contract." },
      { title: "Fund, Track & Complete", copy: "Make milestone payments and track results." },
    ],
  },
  whyChoose: {
    title: "Why Businesses Choose Influrios",
    items: [
      "Global influencer network",
      "Specialty-based discovery",
      "Verified influencers",
      "Structured agreements",
      "Protected payments",
      "Campaign analytics",
    ],
    photoCaption: "Great Influencers. Stronger Brands.",
  },
  plans: {
    title: "Business Account Plans",
    items: [
      {
        code: "STARTER",
        name: "Starter",
        price: "$0",
        detail: "/month",
        points: ["Basic search", "Post collaboration requests", "3 active collaborations"],
        ctaLabel: "Get Started",
        href: "/register?next=%2Fcollaboration%2Fbusiness",
      },
      {
        code: "GROWTH",
        name: "Growth",
        price: "$49",
        detail: "/month",
        points: ["AI influencer suggestions", "Custom milestones", "10 active collaborations", "Basic analytics"],
        ctaLabel: "Get Started",
        href: "/register?next=%2Fcollaboration%2Fbusiness%3Fplan%3DGROWTH",
        popular: true,
      },
      {
        code: "PRO",
        name: "Pro",
        price: "$149",
        detail: "/month",
        points: ["Multi-influencer campaigns", "Custom contract terms", "Advanced analytics", "Priority listing"],
        ctaLabel: "Get Started",
        href: "/register?next=%2Fcollaboration%2Fbusiness%3Fplan%3DPRO",
      },
      {
        code: "ENTERPRISE",
        name: "Enterprise",
        price: "Custom",
        detail: "pricing",
        points: ["Unlimited collaborations", "API access", "Dedicated support", "Agency seats"],
        ctaLabel: "Contact Sales",
        href: "/register?next=%2Fcollaboration%2Fbusiness",
      },
    ],
  },
  signup: {
    title: "Create Your Business Profile",
    subtitle: "Start free. Create your Influrios account, then finish your business workspace setup.",
    checkboxLabel: "I want personalized influencer suggestions based on my business goals.",
    submitLabel: "Create My Business Profile",
    asideTitle: "Not sure who to work with?",
    asideCopy:
      "Get influencer suggestions from your goals, category, and market — then invite the right partners.",
    asideCta: { label: "Get Influencer Suggestions", href: "/collaboration?goal=awareness" },
  },
};

export const DEFAULT_INFLUENCER_IDENTITY: InfluencerIdentityConfig = {
  selfDescriptions: [
    "Influencer",
    "Content Creator",
    "Influencer & Content Creator",
    "Blogger",
    "Podcaster",
    "Photographer",
    "Videographer",
    "Reviewer",
    "Public Figure",
    "Industry Expert",
    "Athlete",
    "Musician / Artist",
    "Other",
  ],
};

/** Role-query synonyms so Discover treats creator / content creator / influencer as related. */
export const ROLE_SEARCH_SYNONYMS = ["creator", "content creator", "influencer", "influencers", "creators"] as const;

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mergeDeep<T extends Record<string, unknown>>(base: T, incoming?: Partial<T> | null): T {
  if (!incoming) return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(incoming)) {
    if (value == null) continue;
    const current = out[key as keyof T];
    if (Array.isArray(value)) {
      if (value.length) (out as Record<string, unknown>)[key] = value;
    } else if (typeof value === "object" && typeof current === "object" && current && !Array.isArray(current)) {
      (out as Record<string, unknown>)[key] = mergeDeep(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else if (typeof value === "string") {
      if (value.trim()) (out as Record<string, unknown>)[key] = value;
    } else {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

async function upsertLandingPayload(key: string, title: string, sortOrder: number, payload: Prisma.InputJsonValue) {
  await prisma.cmsSection.upsert({
    where: { key },
    create: {
      key,
      title,
      sortOrder,
      enabled: true,
      status: "published",
      payload,
    },
    update: { payload },
  });
}

async function readLandingPayload(key: string): Promise<Record<string, unknown> | null> {
  const row = await prisma.cmsSection.findUnique({ where: { key }, select: { payload: true } });
  return asObject(row?.payload ?? null);
}

export function mergeCollaborationLanding(
  incoming?: Partial<CollaborationLandingConfig> | null,
): CollaborationLandingConfig {
  return mergeDeep(
    DEFAULT_COLLABORATION_LANDING as unknown as Record<string, unknown>,
    incoming as Partial<Record<string, unknown>> | null,
  ) as unknown as CollaborationLandingConfig;
}

const RETIRED_BUSINESS_DIRECTORY_TITLE = "Recommended Influencers for Your Business";
const RETIRED_BUSINESS_DIRECTORY_SUBTITLE =
  "Example matches from the Influrios directory — open a profile when you are ready.";

export function mergeBusinessLanding(incoming?: Partial<BusinessLandingConfig> | null): BusinessLandingConfig {
  const merged = mergeDeep(
    DEFAULT_BUSINESS_LANDING as unknown as Record<string, unknown>,
    incoming as Partial<Record<string, unknown>> | null,
  ) as unknown as BusinessLandingConfig;
  if (merged.recommended.title.trim() === RETIRED_BUSINESS_DIRECTORY_TITLE) {
    merged.recommended.title = DEFAULT_BUSINESS_LANDING.recommended.title;
  }
  if (merged.recommended.subtitle.trim() === RETIRED_BUSINESS_DIRECTORY_SUBTITLE) {
    merged.recommended.subtitle = DEFAULT_BUSINESS_LANDING.recommended.subtitle;
  }
  return merged;
}

export function mergeInfluencerIdentity(
  incoming?: Partial<InfluencerIdentityConfig> | null,
): InfluencerIdentityConfig {
  const base = structuredClone(DEFAULT_INFLUENCER_IDENTITY);
  if (incoming?.selfDescriptions?.length) {
    base.selfDescriptions = incoming.selfDescriptions.filter((item) => item.trim());
  }
  return base;
}

export async function getCollaborationLanding(): Promise<CollaborationLandingConfig> {
  const raw = await readLandingPayload(COLLAB_LANDING_KEY);
  if (!raw) {
    await upsertLandingPayload(
      COLLAB_LANDING_KEY,
      "Collaboration landing",
      20,
      DEFAULT_COLLABORATION_LANDING as unknown as Prisma.InputJsonValue,
    );
    return structuredClone(DEFAULT_COLLABORATION_LANDING);
  }
  return mergeCollaborationLanding(raw as Partial<CollaborationLandingConfig>);
}

export async function getBusinessLanding(): Promise<BusinessLandingConfig> {
  const raw = await readLandingPayload(BUSINESS_LANDING_KEY);
  if (!raw) {
    await upsertLandingPayload(
      BUSINESS_LANDING_KEY,
      "Business landing",
      21,
      DEFAULT_BUSINESS_LANDING as unknown as Prisma.InputJsonValue,
    );
    return structuredClone(DEFAULT_BUSINESS_LANDING);
  }
  return mergeBusinessLanding(raw as Partial<BusinessLandingConfig>);
}

export async function getInfluencerIdentity(): Promise<InfluencerIdentityConfig> {
  const raw = await readLandingPayload(IDENTITY_KEY);
  if (!raw) {
    await upsertLandingPayload(
      IDENTITY_KEY,
      "Influencer identity labels",
      22,
      DEFAULT_INFLUENCER_IDENTITY as unknown as Prisma.InputJsonValue,
    );
    return structuredClone(DEFAULT_INFLUENCER_IDENTITY);
  }
  return mergeInfluencerIdentity(raw as Partial<InfluencerIdentityConfig>);
}

export async function updateCollaborationLanding(
  patch: Partial<CollaborationLandingConfig>,
): Promise<CollaborationLandingConfig> {
  const current = await getCollaborationLanding();
  const next = mergeCollaborationLanding({ ...current, ...patch });
  await upsertLandingPayload(
    COLLAB_LANDING_KEY,
    "Collaboration landing",
    20,
    next as unknown as Prisma.InputJsonValue,
  );
  return next;
}

export async function updateBusinessLanding(patch: Partial<BusinessLandingConfig>): Promise<BusinessLandingConfig> {
  const current = await getBusinessLanding();
  const next = mergeBusinessLanding({ ...current, ...patch });
  await upsertLandingPayload(BUSINESS_LANDING_KEY, "Business landing", 21, next as unknown as Prisma.InputJsonValue);
  return next;
}

export async function updateInfluencerIdentity(
  patch: Partial<InfluencerIdentityConfig>,
): Promise<InfluencerIdentityConfig> {
  const current = await getInfluencerIdentity();
  const next = mergeInfluencerIdentity({ ...current, ...patch });
  await upsertLandingPayload(IDENTITY_KEY, "Influencer identity labels", 22, next as unknown as Prisma.InputJsonValue);
  return next;
}

/** True when a search query is only a platform-role synonym (should not exclude profiles). */
export function isRoleOnlySearchQuery(q: string | undefined | null): boolean {
  if (!q) return false;
  const normalized = q.toLowerCase().trim().replace(/\s+/g, " ");
  return (ROLE_SEARCH_SYNONYMS as readonly string[]).includes(normalized);
}

export {
  COLLAB_LANDING_KEY,
  BUSINESS_LANDING_KEY,
  IDENTITY_KEY,
};
