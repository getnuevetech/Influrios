import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EmailNotificationsPage() {
  redirect("/account?tab=notifications");
}
