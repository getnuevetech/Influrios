import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEFAULT_GUEST_POLICY } from "@/lib/account-policy";
import { requireAdminSession, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guest gates" };

async function savePolicy(formData: FormData) {
  "use server";
  await requireAdminSession("plans.edit");
  const num = (key: string, fallback: number) => {
    const value = Number(formData.get(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };
  await prisma.guestUsagePolicy.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      profileViewSoft: num("profileViewSoft", DEFAULT_GUEST_POLICY.profileViewSoft),
      profileViewHard: num("profileViewHard", DEFAULT_GUEST_POLICY.profileViewHard),
      searchSoft: num("searchSoft", DEFAULT_GUEST_POLICY.searchSoft),
      searchHard: num("searchHard", DEFAULT_GUEST_POLICY.searchHard),
      softCopy: String(formData.get("softCopy") || DEFAULT_GUEST_POLICY.softCopy),
      hardCopy: String(formData.get("hardCopy") || DEFAULT_GUEST_POLICY.hardCopy),
    },
    update: {
      profileViewSoft: num("profileViewSoft", DEFAULT_GUEST_POLICY.profileViewSoft),
      profileViewHard: num("profileViewHard", DEFAULT_GUEST_POLICY.profileViewHard),
      searchSoft: num("searchSoft", DEFAULT_GUEST_POLICY.searchSoft),
      searchHard: num("searchHard", DEFAULT_GUEST_POLICY.searchHard),
      softCopy: String(formData.get("softCopy") || DEFAULT_GUEST_POLICY.softCopy),
      hardCopy: String(formData.get("hardCopy") || DEFAULT_GUEST_POLICY.hardCopy),
    },
  });
  redirect("/admin/guests?saved=1");
}

export default async function GuestPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  try {
    await requireAdminSession("plans.view");
  } catch (error) {
    if (error instanceof AdminAuthError && error.code === "unauthorized") redirect("/admin/login?next=/admin/guests");
    redirect("/admin");
  }
  const params = await searchParams;
  const policy = (await prisma.guestUsagePolicy.findUnique({ where: { id: "default" } }).catch(() => null)) ?? {
    ...DEFAULT_GUEST_POLICY,
  };
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-indigo">Guest gates</h1>
      <p className="mt-2 text-sm text-muted">
        Signed-in accounts skip these limits. A hard stop sends the guest to register and back to the page they opened.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      <form action={savePolicy} className="mt-6 space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
        {(
          [
            ["profileViewSoft", "Profile views before the soft prompt", policy.profileViewSoft],
            ["profileViewHard", "Profile views before sign-in is required", policy.profileViewHard],
            ["searchSoft", "Searches before the soft prompt", policy.searchSoft],
            ["searchHard", "Searches before sign-in is required", policy.searchHard],
          ] as const
        ).map(([name, label, value]) => (
          <label key={name} className="block text-sm font-semibold text-indigo">
            {label}
            <input name={name} type="number" min={1} defaultValue={value} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
        ))}
        <label className="block text-sm font-semibold text-indigo">
          Soft prompt
          <textarea name="softCopy" defaultValue={policy.softCopy} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" rows={3} />
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Hard stop
          <textarea name="hardCopy" defaultValue={policy.hardCopy} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" rows={3} />
        </label>
        <button type="submit" className="btn-primary">
          Save gates
        </button>
      </form>
    </div>
  );
}
