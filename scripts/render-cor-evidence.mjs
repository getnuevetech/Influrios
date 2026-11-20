import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, mkdirSync } from "fs";
import { WorkspaceDialogBody } from "../src/components/workspace-milestones.tsx";

const out = new URL("../media/cor-20-23-acceptance/", import.meta.url);
mkdirSync(out, { recursive: true });

const css = `
  :root { --indigo:#1B1464; --violet:#6D4AFF; --line:#E4E9F5; --muted:#667085; }
  body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#F6F7FC;color:var(--indigo)}
  .wrap{max-width:720px;margin:24px auto;background:#fff;border:1px solid var(--line);border-radius:28px;padding:24px;box-shadow:0 10px 40px rgba(27,20,100,.06)}
  .label{font-size:12px;font-weight:700;color:var(--muted);margin:16px 24px 0}
  .font-display{font-family:ui-sans-serif,system-ui,sans-serif}
  .text-xl{font-size:1.25rem;line-height:1.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xs{font-size:.75rem;line-height:1rem}
  .font-bold{font-weight:700}.font-semibold{font-weight:600}.font-normal{font-weight:400}
  .text-\\[\\#1B1464\\],.text-\\[\\#1B1464\\] *{color:#1B1464}
  .text-\\[\\#667085\\]{color:#667085}.text-\\[\\#344054\\]{color:#344054}.text-\\[\\#1D4ED8\\]{color:#1D4ED8}
  .text-\\[\\#B54708\\]{color:#B54708}.text-\\[\\#B42318\\]{color:#B42318}.text-\\[\\#087B5A\\]{color:#087B5A}
  .text-white{color:#fff}.bg-\\[\\#6D4AFF\\]{background:#6D4AFF}.bg-\\[\\#FFF7E8\\]{background:#FFF7E8}
  .bg-\\[\\#FFF8F7\\]{background:#FFF8F7}.bg-\\[\\#EEF4FF\\]{background:#EEF4FF}.bg-\\[\\#FAFBFF\\]{background:#FAFBFF}
  .bg-\\[\\#F6F7FC\\]{background:#F6F7FC}.bg-white{background:#fff}
  .border{border-width:1px;border-style:solid}.border-\\[\\#E4E9F5\\]{border-color:#E4E9F5}.border-\\[\\#F4A3A0\\]{border-color:#F4A3A0}
  .rounded-xl{border-radius:12px}.rounded-2xl{border-radius:16px}.rounded-full{border-radius:9999px}
  .mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}
  .px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}
  .py-2{padding-top:.5rem;padding-bottom:.5rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}
  .w-full{width:100%}.block{display:block}.inline-flex{display:inline-flex}.flex{display:flex}
  .flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-end{justify-content:flex-end}.justify-between{justify-content:space-between}
  .gap-2{gap:.5rem}.space-y-2 > :not([hidden]) ~ :not([hidden]){margin-top:.5rem}.space-y-3 > :not([hidden]) ~ :not([hidden]){margin-top:.75rem}
  .h-9{height:2.25rem}.h-11{min-height:2.75rem}.min-h-11{min-height:2.75rem}
  .ml-auto{margin-left:auto}.cursor-pointer{cursor:pointer}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
  input,textarea,button{font:inherit}a{color:inherit}
  @media (max-width:420px){.wrap{margin:0;border-radius:0;min-height:100vh;box-shadow:none}}
`;

function page(title, body, widthMeta = "device-width") {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=${widthMeta},initial-scale=1"/><title>${title}</title><style>${css}</style></head><body><p class="label">${title}</p><div class="wrap">${body}</div></body></html>`;
}

const noop = async () => ({ ok: false, error: "unused" });

const submitError = renderToStaticMarkup(
  h(WorkspaceDialogBody, {
    title: "Submit a version",
    subtitle: "Kickoff · Version 1",
    closeHref: "#",
    feedback: null,
    history: [],
    paymentHistory: [],
    holdReason: null,
    bankLine: null,
    mode: "submit",
    showSubmitForm: true,
    submitLabel: "Submit version 1",
    reviewVersion: null,
    canRequestChanges: false,
    approveHref: null,
    dealId: "deal",
    milestoneId: "m1",
    tab: "milestones",
    submitAction: noop,
    draftNote: "short",
    draftLink: "",
    formError: "Add a note, an https link, or a file so the business can review this version.",
  }),
);

const linkPreview = renderToStaticMarkup(
  h(WorkspaceDialogBody, {
    title: "Submit a version",
    subtitle: "Kickoff · Version 1",
    closeHref: "#",
    feedback: null,
    history: [],
    paymentHistory: [],
    holdReason: null,
    bankLine: null,
    mode: "submit",
    showSubmitForm: true,
    submitLabel: "Submit version 1",
    reviewVersion: null,
    canRequestChanges: false,
    approveHref: null,
    dealId: "deal",
    milestoneId: "m1",
    tab: "milestones",
    submitAction: noop,
    draftNote: "Cut link for review",
    draftLink: "drive.google.com/file/d/abc",
  }),
);

const reviewHub = renderToStaticMarkup(
  h(WorkspaceDialogBody, {
    title: "Review version 2",
    subtitle: "Kickoff · Version 2",
    closeHref: "#",
    feedback: null,
    history: ["Version 2 · Submitted. Note: outro extended Saved as https://drive.example/cut."],
    paymentHistory: [],
    holdReason: null,
    bankLine: null,
    mode: "review",
    reviewStep: "hub",
    showSubmitForm: false,
    submitLabel: null,
    reviewVersion: 2,
    canRequestChanges: true,
    approveHref: "#approve",
    requestChangesHref: "#changes",
    reviewSummary: {
      note: "outro extended",
      linkUrl: "https://drive.example/cut",
      files: [{ id: "f1", fileName: "cut.mp4" }],
    },
    dealId: "deal",
    milestoneId: "m1",
    tab: "milestones",
    reviseAction: noop,
  }),
);

const reviewChanges = renderToStaticMarkup(
  h(WorkspaceDialogBody, {
    title: "Request changes · version 2",
    subtitle: "Kickoff · Version 2",
    closeHref: "#",
    feedback: null,
    history: [],
    paymentHistory: [],
    holdReason: null,
    bankLine: null,
    mode: "review",
    reviewStep: "changes",
    showSubmitForm: false,
    submitLabel: null,
    reviewVersion: 2,
    canRequestChanges: true,
    approveHref: null,
    reviewHubHref: "#hub",
    reviewSummary: {
      note: "outro extended",
      linkUrl: "https://drive.example/cut",
      files: [{ id: "f1", fileName: "cut.mp4" }],
    },
    dealId: "deal",
    milestoneId: "m1",
    tab: "milestones",
    reviseAction: noop,
    draftNote: "Extend the CTA by 2 seconds",
  }),
);

writeFileSync(new URL("submit-error-desktop.html", out), page("COR-20 · submit error stays in popup", submitError));
writeFileSync(new URL("submit-error-mobile.html", out), page("COR-20 · mobile 390", submitError, "390"));
writeFileSync(new URL("link-normalize-desktop.html", out), page("COR-22 · Will save as preview", linkPreview));
writeFileSync(new URL("review-hub-desktop.html", out), page("COR-23 · review hub", reviewHub));
writeFileSync(new URL("request-changes-desktop.html", out), page("COR-23 · request changes only", reviewChanges));
writeFileSync(new URL("request-changes-mobile.html", out), page("COR-23 · mobile request changes", reviewChanges, "390"));
console.log("wrote evidence html to", out.pathname);
