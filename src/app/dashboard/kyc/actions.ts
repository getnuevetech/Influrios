"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppOrigin } from "@/lib/billing";
import { getCreatorSessionDraft } from "@/lib/claim";
import { countryCodeFromLocation } from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { kycTypeByCode } from "@/lib/kyc-types";
import { listKycRequirements, startGatewayKyc, submitDocumentKyc } from "@/lib/kyc-document";

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

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

function asUploadFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === "string") return null;
  if (typeof (value as File).arrayBuffer !== "function") return null;
  if ((value as File).size <= 0) return null;
  return value as File;
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
      const file = asUploadFile(formData.get(`document:${requirement.id}`));
      if (file) files.push({ requirementId: requirement.id, file });
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
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Could not submit KYC.";
    redirect(`/dashboard/kyc?error=${encodeURIComponent(message.slice(0, 280))}`);
  }
  revalidatePath("/dashboard/kyc");
  redirect("/dashboard/kyc?saved=submitted");
}

export async function actionStartGatewayKyc() {
  const { draft, creator, countryCode, kyc } = await creatorContext();
  if (kyc?.code !== "gateway") {
    redirect("/dashboard/kyc?error=Your%20country%20uses%20a%20different%20KYC%20type.");
  }
  const origin = getAppOrigin();
  try {
    await startGatewayKyc({
      slug: draft.slug,
      countryCode,
      creatorId: creator?.id ?? null,
      returnUrl: `${origin}/dashboard/kyc`,
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Could not start gateway KYC.";
    redirect(`/dashboard/kyc?error=${encodeURIComponent(message.slice(0, 280))}`);
  }
  revalidatePath("/dashboard/kyc");
  redirect("/dashboard/kyc?saved=gateway");
}
