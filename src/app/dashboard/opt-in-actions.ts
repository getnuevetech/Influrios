"use server";

import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import { getDirectory } from "@/lib/directory";
import { setCreatorOptIn } from "@/lib/managed-matching";

export async function actionSaveCreatorOptIn(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const directory = await getDirectory().catch(() => null);
  const allowed = new Set(
    (directory?.taxonomy ?? []).flatMap((group) => [group.slug, ...group.children.map((child) => child.slug)]),
  );
  const niches = formData
    .getAll("niche")
    .map((value) => String(value).trim())
    .filter((slug) => allowed.has(slug));
  await setCreatorOptIn(draft.slug, {
    openToManaged: formData.get("openToManaged") === "on",
    niches,
    targetingNotes: String(formData.get("targetingNotes") ?? "").trim(),
  });
  redirect("/dashboard?saved=optin");
}
