/**
 * Formal agreement layout for on-screen preview.
 * Renders the same HTML article the downloadable PDF prints, so both copies stay identical.
 */
import {
  formalAgreementLayoutCss,
  renderFormalAgreementArticleHtml,
  type FormalAgreementHtmlInput,
} from "@/lib/formal-agreement-markup";

export type FormalAgreementParty = FormalAgreementHtmlInput["parties"][number];
export type FormalAgreementMilestone = FormalAgreementHtmlInput["milestones"][number];
export type FormalAgreementProps = FormalAgreementHtmlInput;

export function FormalAgreementDocument({
  title,
  campaign,
  agreementRef,
  versionLabel,
  parties,
  body,
  compensation,
  commercial,
  milestones,
  showFeeColumns = true,
  draft = false,
  footerNote = "Agreement preview",
}: FormalAgreementProps) {
  const input: FormalAgreementHtmlInput = {
    title,
    campaign,
    agreementRef,
    versionLabel,
    parties,
    body,
    compensation,
    commercial,
    milestones,
    showFeeColumns,
    draft,
    footerNote,
  };
  return (
    <div className="formal-agreement-host">
      <style dangerouslySetInnerHTML={{ __html: formalAgreementLayoutCss() }} />
      <div dangerouslySetInnerHTML={{ __html: renderFormalAgreementArticleHtml(input) }} />
    </div>
  );
}
