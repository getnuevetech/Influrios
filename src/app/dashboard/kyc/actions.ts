"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import { countryCodeFromLocation } from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { kycTypeByCode } from "@/lib/kyc-types";
import { listKycRequirements, startGatewayKyc, submitDocumentKyc } from "@/lib/kyc-document";

async function creatorContext() {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const creator = await prisma.creator.findUnique({ where: { slug: draft.slug } });
  const countryCode = countryCodeFromLocation(draft.locationCountry) ?? "";
  const corridor = countryCode
    ? await prisma.countryActivationCorridor.findUnique({ where: { countryCode } })
    : null;
  return { draft, creator, countryCode, kyc: kycTypeByCode(corridor?.kycModel) };
}

export async function actionSubmitDocumentKyc(formData: FormData) {
  const { draft, creator, countryCode, kyc } = await creatorContext();
  if (kyc?.code !== "government_id") {
    redirect("/dashboard/kyc?error=Your%20country%20uses%20a%20different%20KYC%20type.");
  }
  const requirements = await listKycRequirements();
  const details: Record<string, string> = {};
  const files: { requirementId: string; file: File }[] = [];
  for (const requirement of requirements) {
    if (requirement.kind === "detail") {
      details[requirement.id] = String(formData.get(`detail:${requirement.id}`) ?? "");
    } else {
      const file = formData.get(`document:${requirement.id}`);
      if (file instanceof File) files.push({ requirementId: requirement.id, file });
    }
  }
  try {
    await submitDocumentKyc({
      slug: draft.slug,
      countryCode,
      creatorId: creator?.id ?? null,
      details,
      files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit KYC.";
    redirect(`/dashboard/kyc?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/kyc");
  redirect("/dashboard/kyc?saved=submitted");
}

export async function actionStartGatewayKyc() {
  const { draft, creator, countryCode, kyc } = await creatorContext();
  if (kyc?.code !== "gateway") {
    redirect("/dashboard/kyc?error=Your%20country%20uses%20a%20different%20KYC%20type.");
  }
  try {
    await startGatewayKyc({ slug: draft.slug, countryCode, creatorId: creator?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start gateway KYC.";
    redirect(`/dashboard/kyc?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/kyc");
  redirect("/dashboard/kyc?saved=gateway");
}
