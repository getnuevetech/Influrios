"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  updateBusinessLanding,
  updateCollaborationLanding,
  updateInfluencerIdentity,
  type BusinessLandingConfig,
  type CollaborationLandingConfig,
} from "@/lib/landing-pages";

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function actionSaveCollaborationLanding(formData: FormData) {
  await requireAdminAction("banners.edit");
  try {
    const patch: Partial<CollaborationLandingConfig> = {
      hero: {
        title: String(formData.get("heroTitle") ?? "").trim(),
        subtitle: String(formData.get("heroSubtitle") ?? "").trim(),
        primaryCta: {
          label: String(formData.get("heroPrimaryLabel") ?? "").trim(),
          href: String(formData.get("heroPrimaryHref") ?? "").trim(),
        },
        secondaryCta: {
          label: String(formData.get("heroSecondaryLabel") ?? "").trim(),
          href: String(formData.get("heroSecondaryHref") ?? "").trim(),
        },
        searchPlaceholder: String(formData.get("heroSearchPlaceholder") ?? "").trim(),
        tags: lines(formData.get("heroTags")),
        collageLabels: lines(formData.get("heroCollageLabels")),
      },
      popularMatches: {
        title: String(formData.get("popularTitle") ?? "").trim(),
        subtitle: String(formData.get("popularSubtitle") ?? "").trim(),
        ctaLabel: String(formData.get("popularCtaLabel") ?? "").trim(),
        ctaHref: String(formData.get("popularCtaHref") ?? "").trim(),
      },
      dualPath: {
        title: String(formData.get("dualTitle") ?? "").trim(),
        business: {
          eyebrow: String(formData.get("dualBusinessEyebrow") ?? "").trim(),
          title: String(formData.get("dualBusinessTitle") ?? "").trim(),
          points: lines(formData.get("dualBusinessPoints")),
          cta: {
            label: String(formData.get("dualBusinessCtaLabel") ?? "").trim(),
            href: String(formData.get("dualBusinessCtaHref") ?? "").trim(),
          },
        },
        influencer: {
          eyebrow: String(formData.get("dualInfluencerEyebrow") ?? "").trim(),
          title: String(formData.get("dualInfluencerTitle") ?? "").trim(),
          points: lines(formData.get("dualInfluencerPoints")),
          cta: {
            label: String(formData.get("dualInfluencerCtaLabel") ?? "").trim(),
            href: String(formData.get("dualInfluencerCtaHref") ?? "").trim(),
          },
        },
      },
      featured: {
        title: String(formData.get("featuredTitle") ?? "").trim(),
        subtitle: String(formData.get("featuredSubtitle") ?? "").trim(),
        ctaLabel: String(formData.get("featuredCtaLabel") ?? "").trim(),
        ctaHref: String(formData.get("featuredCtaHref") ?? "").trim(),
      },
      marketplace: {
        businessTitle: String(formData.get("marketBusinessTitle") ?? "").trim(),
        businessSubtitle: String(formData.get("marketBusinessSubtitle") ?? "").trim(),
        influencerTitle: String(formData.get("marketInfluencerTitle") ?? "").trim(),
        influencerSubtitle: String(formData.get("marketInfluencerSubtitle") ?? "").trim(),
      },
      suggestionsBanner: {
        title: String(formData.get("suggestionsTitle") ?? "").trim(),
        subtitle: String(formData.get("suggestionsSubtitle") ?? "").trim(),
        cta: {
          label: String(formData.get("suggestionsCtaLabel") ?? "").trim(),
          href: String(formData.get("suggestionsCtaHref") ?? "").trim(),
        },
      },
      howItWorks: {
        title: String(formData.get("howTitle") ?? "").trim(),
        steps: lines(formData.get("howSteps")),
      },
      features: {
        businessTitle: String(formData.get("featuresBusinessTitle") ?? "").trim(),
        businessItems: lines(formData.get("featuresBusinessItems")),
        influencerTitle: String(formData.get("featuresInfluencerTitle") ?? "").trim(),
        influencerItems: lines(formData.get("featuresInfluencerItems")),
      },
      protectedPayments: {
        title: String(formData.get("paymentsTitle") ?? "").trim(),
        subtitle: String(formData.get("paymentsSubtitle") ?? "").trim(),
        steps: lines(formData.get("paymentsSteps")),
      },
      collabTypes: {
        title: String(formData.get("typesTitle") ?? "").trim(),
        items: lines(formData.get("typesItems")),
      },
      mentorship: {
        title: String(formData.get("mentorTitle") ?? "").trim(),
        subtitle: String(formData.get("mentorSubtitle") ?? "").trim(),
        findCta: {
          label: String(formData.get("mentorFindLabel") ?? "").trim(),
          href: String(formData.get("mentorFindHref") ?? "").trim(),
        },
        becomeCta: {
          label: String(formData.get("mentorBecomeLabel") ?? "").trim(),
          href: String(formData.get("mentorBecomeHref") ?? "").trim(),
        },
      },
      trustBar: {
        title: String(formData.get("trustTitle") ?? "").trim(),
        items: lines(formData.get("trustItems")),
      },
      finalCtas: {
        influencer: {
          title: String(formData.get("finalInfluencerTitle") ?? "").trim(),
          points: lines(formData.get("finalInfluencerPoints")),
          cta: {
            label: String(formData.get("finalInfluencerCtaLabel") ?? "").trim(),
            href: String(formData.get("finalInfluencerCtaHref") ?? "").trim(),
          },
        },
        business: {
          title: String(formData.get("finalBusinessTitle") ?? "").trim(),
          points: lines(formData.get("finalBusinessPoints")),
          cta: {
            label: String(formData.get("finalBusinessCtaLabel") ?? "").trim(),
            href: String(formData.get("finalBusinessCtaHref") ?? "").trim(),
          },
        },
      },
    };
    await updateCollaborationLanding(patch);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save collaboration landing";
    redirect(`/admin/collaboration-landing?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/collaboration-landing?saved=1");
}

export async function actionSaveBusinessLanding(formData: FormData) {
  await requireAdminAction("banners.edit");
  try {
    const capabilityTitles = formData.getAll("capabilityTitle").map(String);
    const capabilityCopy = formData.getAll("capabilityCopy").map(String);
    const stepTitles = formData.getAll("stepTitle").map(String);
    const stepCopy = formData.getAll("stepCopy").map(String);
    const planCodes = formData.getAll("planCode").map(String);
    const planNames = formData.getAll("planName").map(String);
    const planPrices = formData.getAll("planPrice").map(String);
    const planDetails = formData.getAll("planDetail").map(String);
    const planPoints = formData.getAll("planPoints").map(String);
    const planCtaLabels = formData.getAll("planCtaLabel").map(String);
    const planHrefs = formData.getAll("planHref").map(String);
    const planPopular = formData.getAll("planPopular").map(String);

    const patch: Partial<BusinessLandingConfig> = {
      hero: {
        eyebrow: String(formData.get("heroEyebrow") ?? "").trim(),
        title: String(formData.get("heroTitle") ?? "").trim(),
        titleHighlight: String(formData.get("heroTitleHighlight") ?? "").trim(),
        subtitle: String(formData.get("heroSubtitle") ?? "").trim(),
        primaryCta: {
          label: String(formData.get("heroPrimaryLabel") ?? "").trim(),
          href: String(formData.get("heroPrimaryHref") ?? "").trim(),
        },
        secondaryCta: {
          label: String(formData.get("heroSecondaryLabel") ?? "").trim(),
          href: String(formData.get("heroSecondaryHref") ?? "").trim(),
        },
        searchPlaceholder: String(formData.get("heroSearchPlaceholder") ?? "").trim(),
        tags: lines(formData.get("heroTags")),
        collageNote: String(formData.get("heroCollageNote") ?? "").trim(),
        floatingNotes: lines(formData.get("heroFloatingNotes")),
      },
      capabilities: {
        title: String(formData.get("capabilitiesTitle") ?? "").trim(),
        items: capabilityTitles
          .map((title, index) => ({
            title: title.trim(),
            copy: (capabilityCopy[index] ?? "").trim(),
          }))
          .filter((item) => item.title),
      },
      recommended: {
        title: String(formData.get("recommendedTitle") ?? "").trim(),
        subtitle: String(formData.get("recommendedSubtitle") ?? "").trim(),
        ctaLabel: String(formData.get("recommendedCtaLabel") ?? "").trim(),
        ctaHref: String(formData.get("recommendedCtaHref") ?? "").trim(),
      },
      howItWorks: {
        title: String(formData.get("howTitle") ?? "").trim(),
        steps: stepTitles
          .map((title, index) => ({
            title: title.trim(),
            copy: (stepCopy[index] ?? "").trim(),
          }))
          .filter((item) => item.title),
      },
      whyChoose: {
        title: String(formData.get("whyTitle") ?? "").trim(),
        items: lines(formData.get("whyItems")),
        photoCaption: String(formData.get("whyCaption") ?? "").trim(),
      },
      plans: {
        title: String(formData.get("plansTitle") ?? "").trim(),
        items: planCodes
          .map((code, index) => ({
            code: code.trim(),
            name: (planNames[index] ?? "").trim(),
            price: (planPrices[index] ?? "").trim(),
            detail: (planDetails[index] ?? "").trim(),
            points: lines(planPoints[index] ?? ""),
            ctaLabel: (planCtaLabels[index] ?? "").trim(),
            href: (planHrefs[index] ?? "").trim(),
            popular: planPopular[index] === "1",
          }))
          .filter((item) => item.code && item.name),
      },
      signup: {
        title: String(formData.get("signupTitle") ?? "").trim(),
        subtitle: String(formData.get("signupSubtitle") ?? "").trim(),
        checkboxLabel: String(formData.get("signupCheckbox") ?? "").trim(),
        submitLabel: String(formData.get("signupSubmit") ?? "").trim(),
        asideTitle: String(formData.get("asideTitle") ?? "").trim(),
        asideCopy: String(formData.get("asideCopy") ?? "").trim(),
        asideCta: {
          label: String(formData.get("asideCtaLabel") ?? "").trim(),
          href: String(formData.get("asideCtaHref") ?? "").trim(),
        },
      },
    };
    await updateBusinessLanding(patch);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save business landing";
    redirect(`/admin/business-landing?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/business-landing?saved=1");
}

export async function actionSaveInfluencerIdentity(formData: FormData) {
  await requireAdminAction("banners.edit");
  try {
    await updateInfluencerIdentity({
      selfDescriptions: lines(formData.get("selfDescriptions")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save identity labels";
    redirect(`/admin/influencer-identity?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/influencer-identity?saved=1");
}
