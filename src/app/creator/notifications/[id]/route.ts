import { redirect } from "next/navigation";
import { markNoticeRead } from "@/lib/account-notices";
import { getAccountSession } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(`/creator/notifications/${id}`)}`);
  const href = await markNoticeRead(account.id, id).catch(() => null);
  redirect(href || "/creator/notifications");
}
