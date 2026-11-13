/**
 * The agreement popup's primary action follows the viewer.
 * Funding still starts on the existing signed-contract page. This choice does not move money.
 */

import { contractFundingCta } from "@/lib/signed-funding";

export type AgreementFooterAction = {
  label: "Review and sign" | "Fund collaboration" | "Open workspace";
  href: string;
};

export function agreementFooterAction(input: {
  signHref: string | null;
  contractHref: string;
  workspaceHref: string | null;
  depositHref: string | null;
  role: string | null | undefined;
  contractStatus: string;
  fundingId?: string | null;
  fundingStatus?: string | null;
}): AgreementFooterAction | null {
  if (input.signHref) return { label: "Review and sign", href: input.signHref };
  const funding = contractFundingCta({
    role: input.role,
    status: input.contractStatus,
    fundingId: input.fundingId,
    fundingStatus: input.fundingStatus,
  });
  if (funding.kind === "start") return { label: "Fund collaboration", href: input.contractHref };
  if (funding.kind === "resume" && input.depositHref) return { label: "Fund collaboration", href: input.depositHref };
  if (input.workspaceHref) return { label: "Open workspace", href: input.workspaceHref };
  return null;
}
