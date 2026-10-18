import { MemberFrame } from "@/components/account-shell";

/** Contract wizard is a business account flow. */
export default function ContractWizardLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
