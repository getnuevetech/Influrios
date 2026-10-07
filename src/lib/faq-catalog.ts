export const FAQ_AUDIENCES = ["general", "creator", "business", "agency", "visitor"] as const;

export type FaqAudience = (typeof FAQ_AUDIENCES)[number];

export type FaqSeed = {
  key: string;
  audience: FaqAudience;
  question: string;
  answer: string;
  sortOrder: number;
};

export const FAQ_AUDIENCE_LABELS: Record<FaqAudience, string> = {
  general: "General",
  creator: "Creators",
  business: "Businesses",
  agency: "Agencies",
  visitor: "Visitors",
};

export function isFaqAudience(value: string): value is FaqAudience {
  return (FAQ_AUDIENCES as readonly string[]).includes(value);
}

export const FAQ_SEED: FaqSeed[] = [
  {
    key: "what-is-influrios",
    audience: "general",
    sortOrder: 10,
    question: "What is Influrios?",
    answer:
      "Influrios is the place where a creator publishes an Influencer Card, a business finds that creator, and both sides can move a collaboration into a protected payment.\n\nThe public profile lives on influrios.com. Short links, QR codes, NFC tags, and campaign links live on inflr.me and send people to a destination the creator controls.",
  },
  {
    key: "who-uses-influrios",
    audience: "general",
    sortOrder: 20,
    question: "Who is Influrios for?",
    answer:
      "Creators use it to publish a card, share a short link, and receive collaboration requests.\n\nBusinesses use it to search creators, send proposals, and fund agreed work.\n\nAgencies use it when a plan includes an agency workspace and team seats.\n\nVisitors do not need an account to open a card, scan a QR code, or tap an NFC tag.",
  },
  {
    key: "how-plans-work",
    audience: "general",
    sortOrder: 30,
    question: "How do plans work?",
    answer:
      "A plan is a name plus a set of features an admin saves. Starter, Plus, Pro, Business Free, Business Pro, and Agency are the plans Influrios starts with. They are not a fixed product matrix.\n\nAn admin can change any feature on a plan, including how many campaign links it includes and whether NFC is on. An admin can also create a new plan, hide it from pricing, or remove it once nobody is assigned to it and then create that code again.\n\nStarter stays in the catalog because new creator accounts use it. Its features can still be edited.\n\nA paid plan changes only after Stripe confirms checkout, or when an admin assigns the plan on the member account.",
  },
  {
    key: "what-is-a-campaign-link-count",
    audience: "general",
    sortOrder: 40,
    question: "What does the campaign-link number mean?",
    answer:
      "A campaign link is an address like https://inflr.me/c/spring-launch. It has its own destination. Visits are counted on the creator’s short link.\n\nHow many a creator may have is the Campaign links number an admin saves on that plan. A new plan starts at 0. There is no built-in count. The number is not tied to short links, QR codes, or NFC tags.",
  },
  {
    key: "accounts-and-sign-in",
    audience: "general",
    sortOrder: 50,
    question: "How do I sign in?",
    answer:
      "Creators start at Create Your Card, confirm the email Influrios sends, and then use the dashboard.\n\nBusinesses and agencies sign in from the login page and open the business or agency workspace their plan allows.\n\nIf email delivery is not configured yet, verification cannot complete. An admin saves SMTP under Email & SMS.",
  },
  {
    key: "get-help",
    audience: "general",
    sortOrder: 60,
    question: "How do I get help?",
    answer:
      "Use the section of this FAQ that matches what you are doing. For an account or billing problem, write to hello@influrios.com from the email on the account.\n\nInflurios staff change plans, prices, and features from the admin console. They do not appear as a chat inside the product.",
  },
  {
    key: "creator-publish-card",
    audience: "creator",
    sortOrder: 10,
    question: "How do I publish my card?",
    answer:
      "Open Create Your Card, add your name, photo, specialties, and a social account, then confirm the email code. Publishing makes the card available at influrios.com/c/your-name.\n\nWhat else you can add depends on the plan assigned to you. The dashboard shows the short link, QR code, NFC URL, and campaign links only when that plan includes them.",
  },
  {
    key: "creator-short-link",
    audience: "creator",
    sortOrder: 20,
    question: "What is my short link?",
    answer:
      "A short link is https://inflr.me/your-name. It redirects to the destination saved on the link, which starts as your Influrios card.\n\nIf the plan includes a custom name, you confirm before the old name starts redirecting to the new one. Printed QR codes and NFC tags keep working because they use their own tokens, not the name.",
  },
  {
    key: "creator-campaign-links",
    audience: "creator",
    sortOrder: 30,
    question: "How do I add a campaign link?",
    answer:
      "On the dashboard, under Your links, use Campaign links. Enter a code, a label, and a destination on Influrios or on an https host an admin has allow-listed.\n\nThe form appears when the plan’s campaign-link count is higher than the number you already have. That count is set by an admin on the plan. It is not calculated from your short link.\n\nYou can suspend a campaign link. A suspended link no longer redirects. The code stays reserved until the plan allows another one.",
  },
  {
    key: "creator-qr",
    audience: "creator",
    sortOrder: 40,
    question: "How does the QR code work?",
    answer:
      "When the plan includes a QR code, the dashboard shows an image. The image encodes https://inflr.me/q/{token}. The token is not your name.\n\nScanning it opens the current destination. If the plan includes a dynamic destination, you can change where it goes, or schedule that change, without printing a new code.",
  },
  {
    key: "nfc-write",
    audience: "creator",
    sortOrder: 50,
    question: "How do I put my NFC link on a phone or a tag?",
    answer:
      "When your plan includes NFC, Your links on the dashboard shows a permanent address, https://inflr.me/n/{token}, and a Write to NFC tag button.\n\nOn an Android phone in Chrome, open the dashboard, tap Write to NFC tag, allow NFC if the browser asks, and hold a blank sticker, card, or key fob against the phone until the page says the tag was written. That button is the writer. You do not install a separate NFC app. Write the same URL onto as many blank tags as you need.\n\niPhone does not let a website write an NFC tag. On iPhone, open Shortcuts, create a shortcut that opens the NFC URL from the dashboard, and attach that shortcut to a tag. The address is the same one.\n\nA tap opens the current destination. Changing the destination does not require writing the tag again.\n\nThe visitor’s phone does not store the tag. It only opens the link for that tap. You can also send the URL by message or email.",
  },
  {
    key: "nfc-transfer",
    audience: "creator",
    sortOrder: 60,
    question: "How do I transfer, replace, or stop an NFC tag?",
    answer:
      "The token stays the same when you change the short-link name or the destination. You do not write the tag again for those changes. The physical tag keeps opening the new destination.\n\nTo hand a tag to someone else, give them the sticker or card. The URL still belongs to your Influrios card. There is no file to move onto their phone.\n\nTo replace a lost tag, tap Write to NFC tag on the dashboard and hold a new blank tag to the phone. On iPhone, run the same Shortcut against a new tag. Do not ask for a second token. One active NFC URL belongs to the short link.\n\nTo stop a tag that left your control, suspend the short link from the dashboard or ask an admin to suspend it. The token does not change. Taps then show that the link is unavailable.\n\nChanging phones does not affect a tag that was already written. The tag stores the URL.",
  },
  {
    key: "creator-schedule",
    audience: "creator",
    sortOrder: 70,
    question: "Can I schedule a destination change?",
    answer:
      "Yes, when the plan includes a dynamic destination. Under Your links, choose a destination and a time at least a minute ahead. One change can be pending. Cancel it from the same list if you do not want it to apply.\n\nWhen the time arrives, Influrios updates the destination. The QR token and the NFC token stay the same.",
  },
  {
    key: "creator-collab-pay",
    audience: "creator",
    sortOrder: 80,
    question: "How do collaborations and payments work for me?",
    answer:
      "A business sends a proposal. You accept it in Collaborations. Protected payments hold funds against milestones you submit. Release happens when the agreement says so, not when a page says a payment is simulated.\n\nPayout details are saved on your account. Stripe Connect is used when that integration is configured. Mentorship, when your plan and the paid-mentorship switch allow it, is a separate checkout and does not go into collaboration holding.",
  },
  {
    key: "business-find",
    audience: "business",
    sortOrder: 10,
    question: "How do I find a creator?",
    answer:
      "Open Discover and filter by specialty, place, and language. Opening a card does not start a payment.\n\nA shortlist is available when your business plan includes one. The shortlist size is a feature on that plan, so an admin can raise or lower it without creating a new product name.",
  },
  {
    key: "business-proposal",
    audience: "business",
    sortOrder: 20,
    question: "How do I send a proposal?",
    answer:
      "From the creator card or Collaborations, start a proposal with the work, the price, and the milestones. The creator has to accept before it becomes an agreement.\n\nAn introduction or a saved creator is not a protected payment. Funding starts from the agreement.",
  },
  {
    key: "business-payments",
    audience: "business",
    sortOrder: 30,
    question: "What is a protected payment?",
    answer:
      "A protected payment collects the agreed amount through a configured provider and holds it against the milestones. You do not mark a collaboration paid by opening a checkout page. The provider webhook is what records the payment.\n\nFlutterwave, M-Pesa, Airwallex, and Stripe are used only when an admin has saved those credentials.",
  },
  {
    key: "business-plans",
    audience: "business",
    sortOrder: 40,
    question: "What is included in a business plan?",
    answer:
      "Whatever an admin saved on that plan: shortlist size, inquiries per month, team seats, intelligence, exports, managed matching, and an agency workspace are separate switches or numbers.\n\nBusiness Free, Business Pro, and Agency are the starting plans. A new plan can be created for a different combination. Pricing shows the plans marked public.",
  },
  {
    key: "agency-workspace",
    audience: "agency",
    sortOrder: 10,
    question: "What is an agency workspace?",
    answer:
      "An agency workspace is the business workspace with the agency feature turned on for its plan. It is where a team works on briefs, shortlists, and managed matching for more than one creator.\n\nIf the plan does not include the agency workspace, the agency pages ask for a plan that does. An admin turns that feature on for the plan you are assigned, or assigns a different plan.",
  },
  {
    key: "agency-seats",
    audience: "agency",
    sortOrder: 20,
    question: "How do team seats work?",
    answer:
      "The plan has a team-seat count. The owner invites people by email. An invited person accepts the seat and then signs in with that email.\n\nSeat roles are owner, manager, and member. A member can work in the workspace. Removing a seat frees the count for another invite.\n\nSeats are separate from the agency feature itself. A plan can allow the workspace and still set the seat count to one.",
  },
  {
    key: "agency-matching",
    audience: "agency",
    sortOrder: 30,
    question: "How is managed matching different from a proposal?",
    answer:
      "A proposal is an offer you send to a creator you already chose. Managed matching is a request that Influrios staff work a brief when the plan includes managed matching and that service is switched on.\n\nA match introduction is not a funded collaboration. Funding still starts from an accepted agreement.",
  },
  {
    key: "visitor-open-card",
    audience: "visitor",
    sortOrder: 10,
    question: "Do I need an account to view a creator?",
    answer:
      "No. Open the card link, the short link, the QR code, or the NFC tag. You can read the public profile without signing in.\n\nContact and collaboration buttons follow the creator’s plan. Some cards only show a limited contact path.",
  },
  {
    key: "visitor-tap",
    audience: "visitor",
    sortOrder: 20,
    question: "What happens when I scan a QR code or tap an NFC tag?",
    answer:
      "Your phone opens an inflr.me address. Influrios redirects that address to the creator’s current destination. You do not install an app and you do not receive a file.\n\nNFC must be turned on. Hold the top or back of the phone against the tag, depending on the phone, until the link opens.\n\nIf the page says the link is unavailable, the creator or an admin suspended it. The tag itself does not need to be rewritten for it to work again later.",
  },
  {
    key: "visitor-campaign",
    audience: "visitor",
    sortOrder: 30,
    question: "I opened a link that starts with inflr.me/c/. What is that?",
    answer:
      "That is a campaign link. It is a short address for one promotion, and it can go somewhere other than the creator’s main card. If the page says the campaign was not found, the creator suspended it or the code is not active.",
  },
];
