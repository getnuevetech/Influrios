import { redirect } from "next/navigation";

export default function BusinessCampaignsPage() {
  redirect("/collaboration/business?tab=requests");
}
