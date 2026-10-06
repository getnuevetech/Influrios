"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import {
  cancelMentorshipRequest,
  requestMentorship,
  respondToMentorshipRequest,
  upsertMentorProfile,
  type MentorshipAvailability,
} from "@/lib/mentorship";

const BASE = "/mentorship";

async function requireCreator() {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(BASE)}&gate=mentorship`);
  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) redirect("/claim");
  const creator = await prisma.creator.findUnique({ where: { slug: draft.slug } });
  if (!creator) redirect("/claim");
  return { creator, account };
}

export async function actionBecomeMentor(formData: FormData) {
  const { creator } = await requireCreator();
  const niches = String(formData.get("niches") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const availability = String(formData.get("availability") ?? "open") as MentorshipAvailability;
  const result = await upsertMentorProfile({
    creatorId: creator.id,
    headline: String(formData.get("headline") ?? ""),
    boundaries: String(formData.get("boundaries") ?? ""),
    niches,
    availability,
    maxActiveMentees: Number(formData.get("maxActiveMentees") ?? 5),
  });
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}#become`);
  }
  revalidatePath(BASE);
  redirect(`${BASE}?mentor=1#become`);
}

export async function actionRequestMentor(formData: FormData) {
  const { creator, account } = await requireCreator();
  const mentorCreatorId = String(formData.get("mentorCreatorId") ?? "").trim();
  const result = await requestMentorship({
    menteeCreatorId: creator.id,
    mentorCreatorId,
    message: String(formData.get("message") ?? ""),
    paidRequested: String(formData.get("paidRequested") ?? "") === "1",
    customerEmail: account.email,
    userId: account.id,
  });
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}#find`);
  }
  revalidatePath(BASE);
  if (result.checkoutUrl) redirect(result.checkoutUrl);
  redirect(`${BASE}?requested=1#inbox`);
}

export async function actionRespondMentorship(formData: FormData) {
  const { creator } = await requireCreator();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accepted" && decision !== "declined") {
    redirect(`${BASE}?error=${encodeURIComponent("Choose accept or decline.")}#inbox`);
  }
  const result = await respondToMentorshipRequest({
    requestId,
    mentorCreatorId: creator.id,
    decision,
    responseNote: String(formData.get("responseNote") ?? ""),
  });
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}#inbox`);
  }
  revalidatePath(BASE);
  redirect(`${BASE}?responded=${decision}#inbox`);
}

export async function actionCancelMentorship(formData: FormData) {
  const { creator } = await requireCreator();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const result = await cancelMentorshipRequest({
    requestId,
    menteeCreatorId: creator.id,
  });
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}#inbox`);
  }
  revalidatePath(BASE);
  redirect(`${BASE}?cancelled=1#inbox`);
}
