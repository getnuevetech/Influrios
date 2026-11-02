import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

/** Contract / funding wizard — business only (page + actions already gated). */
export default async function ContractWizardLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/collaboration/contract");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
