"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { addSpecialtySynonym, removeSpecialtySynonym, updateSpecialtyActive } from "@/lib/directory";
import { addDiscoveryFacet, setDiscoveryFacetActive } from "@/lib/discovery-facets";

export async function actionToggleSpecialty(formData: FormData) {
  const session = await requireAdminAction("taxonomy.edit");
  try {
    await updateSpecialtyActive({
      actor: session.email,
      slug: String(formData.get("slug") ?? ""),
      active: formData.get("active") === "true",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update specialty";
    redirect(`/admin/taxonomy?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/taxonomy?saved=1");
}

export async function actionAddSynonym(formData: FormData) {
  const session = await requireAdminAction("taxonomy.edit");
  try {
    await addSpecialtySynonym({
      actor: session.email,
      slug: String(formData.get("slug") ?? ""),
      term: String(formData.get("term") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add synonym";
    redirect(`/admin/taxonomy?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/taxonomy?saved=1");
}

export async function actionAddDiscoveryFacet(formData: FormData) {
  await requireAdminAction("taxonomy.edit");
  try {
    await addDiscoveryFacet({
      kind: String(formData.get("kind") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that term";
    redirect(`/admin/taxonomy?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/taxonomy?saved=1");
}

export async function actionToggleDiscoveryFacet(formData: FormData) {
  await requireAdminAction("taxonomy.edit");
  try {
    await setDiscoveryFacetActive({
      id: String(formData.get("id") ?? ""),
      active: formData.get("active") === "true",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update that term";
    redirect(`/admin/taxonomy?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/taxonomy?saved=1");
}

export async function actionRemoveSynonym(formData: FormData) {
  const session = await requireAdminAction("taxonomy.edit");
  try {
    await removeSpecialtySynonym({ actor: session.email, id: String(formData.get("id") ?? "") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove synonym";
    redirect(`/admin/taxonomy?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/taxonomy?saved=1");
}
