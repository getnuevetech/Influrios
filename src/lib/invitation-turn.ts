/**
 * Invitation turn tracking and action matrix (Package 1 · master-spec §2.2a/§2.2b · P1-D1).
 *
 * One rule set for the popup, the detail page, projections and the server.
 * Turn changes only on persisted actions; reading never changes it.
 */

export type InvitationTurn = "invitee" | "business" | "none";

export type InvitationState = {
  status: string;
  turn: InvitationTurn;
  interestRecorded: boolean;
  openQuestion: boolean;
};

/** Matrix case (§2.2b). "closed" covers accepted/declined/withdrawn/expired, and past-deadline rows. */
export type InvitationCase = 1 | 2 | 3 | 4 | 5 | 6 | "closed";

export type InviteeIntent = "interested" | "question" | "decline";

const OPEN_STATUSES = new Set(["REQUESTED", "VIEWED", "RESPONDED", "NEGOTIATING"]);

export function asInvitationTurn(value: unknown): InvitationTurn {
  return value === "business" || value === "none" ? value : "invitee";
}

export function invitationState(row: {
  status: string;
  turn?: string | null;
  interestRecorded?: boolean | null;
  openQuestion?: boolean | null;
}): InvitationState {
  return {
    status: row.status,
    turn: asInvitationTurn(row.turn),
    interestRecorded: Boolean(row.interestRecorded),
    openQuestion: Boolean(row.openQuestion),
  };
}

/** Past the Respond-by deadline counts as expired for every count and action, even before the sweep runs. */
export function invitationPastDeadline(responseDeadline: string | Date | null | undefined, now = new Date()): boolean {
  if (!responseDeadline) return false;
  const deadline = responseDeadline instanceof Date ? responseDeadline : new Date(responseDeadline);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime();
}

export function invitationCase(
  state: InvitationState,
  options: { responseDeadline?: string | Date | null; now?: Date } = {},
): InvitationCase {
  if (!OPEN_STATUSES.has(state.status) || state.turn === "none") return "closed";
  if (invitationPastDeadline(options.responseDeadline, options.now)) return "closed";
  const { status, turn, interestRecorded, openQuestion } = state;
  if (status === "REQUESTED" || status === "VIEWED") return 1;
  if (status === "RESPONDED") return 4;
  // NEGOTIATING
  if (!interestRecorded) return openQuestion || turn === "business" ? 2 : 3;
  return openQuestion ? 5 : 6;
}

export type InviteeActions = {
  interested: boolean;
  /** "question" for cases 1/3, "follow-up" for cases 4/6, null when not allowed. */
  ask: "question" | "another" | "follow-up" | null;
  decline: boolean;
};

export function inviteeActionsFor(kase: InvitationCase): InviteeActions {
  switch (kase) {
    case 1:
      return { interested: true, ask: "question", decline: true };
    case 2:
      return { interested: false, ask: null, decline: true };
    case 3:
      return { interested: true, ask: "another", decline: true };
    case 4:
    case 6:
      return { interested: false, ask: "follow-up", decline: true };
    case 5:
      return { interested: false, ask: null, decline: true };
    default:
      return { interested: false, ask: null, decline: false };
  }
}

export function inviteeIntentAllowed(kase: InvitationCase, intent: InviteeIntent): boolean {
  const actions = inviteeActionsFor(kase);
  if (intent === "interested") return actions.interested;
  if (intent === "question") return actions.ask !== null;
  return actions.decline;
}

/** Status path for an invitee response. Never passes through ACCEPTED or COLLABORATION_DRAFTED. */
function inviteeStatusSteps(status: string, intent: InviteeIntent): string[] {
  const viaViewed = status === "REQUESTED" ? ["VIEWED"] : [];
  if (intent === "decline") return ["DECLINED"];
  if (intent === "interested") return status === "RESPONDED" ? [] : [...viaViewed, "RESPONDED"];
  // question / follow-up
  return status === "NEGOTIATING" ? [] : [...viaViewed, "NEGOTIATING"];
}

export type PlannedChange = {
  steps: string[];
  next: InvitationState;
};

/** §2.2b turn transitions for invitee actions. Returns null when the action isn't allowed in this case. */
export function planInviteeResponse(
  state: InvitationState,
  intent: InviteeIntent,
  options: { responseDeadline?: string | Date | null; now?: Date } = {},
): PlannedChange | null {
  const kase = invitationCase(state, options);
  if (!inviteeIntentAllowed(kase, intent)) return null;
  const steps = inviteeStatusSteps(state.status, intent);
  const finalStatus = steps.length ? steps[steps.length - 1] : state.status;
  if (intent === "decline") {
    return { steps, next: { status: finalStatus, turn: "none", interestRecorded: state.interestRecorded, openQuestion: false } };
  }
  if (intent === "interested") {
    return { steps, next: { status: finalStatus, turn: "business", interestRecorded: true, openQuestion: false } };
  }
  // A question (cases 1, 3) or a follow-up (cases 4, 6): the business acts next either way.
  return { steps, next: { status: finalStatus, turn: "business", interestRecorded: state.interestRecorded, openQuestion: true } };
}

/** Business answers the open question: case 2 → 3 (turn → invitee); case 5 → 6 (turn stays business). */
export function planBusinessAnswer(
  state: InvitationState,
  options: { responseDeadline?: string | Date | null; now?: Date } = {},
): PlannedChange | null {
  const kase = invitationCase(state, options);
  if (kase === 2) return { steps: [], next: { ...state, turn: "invitee", openQuestion: false } };
  if (kase === 5) return { steps: [], next: { ...state, turn: "business", openQuestion: false } };
  return null;
}

export type BusinessInvitationAction = "ACCEPTED" | "DECLINED" | "WITHDRAWN";

/**
 * Business actions on its own invitation. Only the business accepts, and only once interest is recorded.
 * "Not a fit" (DECLINED) answers a response the business owes; Withdraw is available while open.
 */
export function businessInvitationActions(
  state: InvitationState,
  options: { responseDeadline?: string | Date | null; now?: Date } = {},
): { actions: BusinessInvitationAction[]; canAnswer: boolean } {
  const kase = invitationCase(state, options);
  if (kase === "closed") return { actions: [], canAnswer: false };
  const actions: BusinessInvitationAction[] = [];
  if (state.interestRecorded) actions.push("ACCEPTED");
  if (state.turn === "business") actions.push("DECLINED");
  actions.push("WITHDRAWN");
  return { actions, canAnswer: kase === 2 || kase === 5 };
}

/** Projection (§1): open, not expired, and the invitee's turn. */
export function invitationWaitingForInvitee(
  row: { status: string; turn?: string | null; interestRecorded?: boolean | null; openQuestion?: boolean | null; responseDeadline?: string | Date | null },
  now = new Date(),
): boolean {
  const kase = invitationCase(invitationState(row), { responseDeadline: row.responseDeadline, now });
  return kase === 1 || kase === 3;
}

/** Projection (§1): every open, unexpired invitation, whoever's turn it is. */
export function invitationIsOpen(
  row: { status: string; turn?: string | null; interestRecorded?: boolean | null; openQuestion?: boolean | null; responseDeadline?: string | Date | null },
  now = new Date(),
): boolean {
  return invitationCase(invitationState(row), { responseDeadline: row.responseDeadline, now }) !== "closed";
}

/** Customer label for the invitee (§2.2b). */
export function inviteeCaseLabel(kase: InvitationCase, business: string): string {
  switch (kase) {
    case 1:
      return "Waiting for your reply";
    case 2:
      return "Question sent";
    case 3:
      return `${business} replied`;
    case 4:
    case 6:
      return "Interested";
    case 5:
      return "Interested · question sent";
    default:
      return "Closed";
  }
}

/** Customer label for the business on its own invitation. */
export function businessCaseLabel(kase: InvitationCase, influencer: string): string {
  switch (kase) {
    case 1:
      return `Waiting for ${influencer}`;
    case 2:
    case 5:
      return `${influencer} asked a question`;
    case 3:
      return `Waiting for ${influencer}`;
    case 4:
    case 6:
      return `${influencer} is interested`;
    default:
      return "Closed";
  }
}

export const NOT_ALLOWED_NOW =
  "That response isn't available for this invitation right now. Here it is as it stands.";

/** Latest invitee question and business answer, read from the invitation's event notes. */
export function invitationConversation(events: { note: string | null }[]): { question: string | null; answer: string | null } {
  let question: string | null = null;
  let answer: string | null = null;
  for (const event of events) {
    const note = event.note ?? "";
    const q = /^(?:Follow-up question|Question): ([\s\S]+)$/.exec(note);
    if (q) {
      question = q[1];
      answer = null;
      continue;
    }
    const a = /^Answer: ([\s\S]+)$/.exec(note);
    if (a) answer = a[1];
  }
  return { question, answer };
}

/** Everything the popup and the detail page need to render the same invitee panel. */
export type InviteeInvitationView = {
  kase: InvitationCase;
  label: string;
  tone: "violet" | "blue" | "green" | "gray";
  actions: InviteeActions;
  question: string | null;
  answer: string | null;
  /** Why a closed invitation is closed, for its own message. */
  closedAs: "accepted" | "declined" | "expired" | "withdrawn" | null;
};

export function inviteeInvitationView(
  row: {
    status: string;
    turn?: string | null;
    interestRecorded?: boolean | null;
    openQuestion?: boolean | null;
    responseDeadline?: string | Date | null;
    events?: { note: string | null }[];
  },
  business: string,
  now = new Date(),
): InviteeInvitationView {
  const kase = invitationCase(invitationState(row), { responseDeadline: row.responseDeadline, now });
  const tone: InviteeInvitationView["tone"] =
    kase === 1 || kase === 3 ? "violet" : kase === 2 ? "blue" : kase === "closed" ? (row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED" ? "green" : "gray") : "green";
  const closedAs =
    kase !== "closed"
      ? null
      : row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED"
        ? "accepted"
        : row.status === "DECLINED"
          ? "declined"
          : row.status === "WITHDRAWN"
            ? "withdrawn"
            : "expired";
  const closedLabel = { accepted: "Accepted", declined: "You declined", expired: "Expired", withdrawn: "Withdrawn" } as const;
  return {
    kase,
    closedAs,
    label: closedAs ? closedLabel[closedAs] : inviteeCaseLabel(kase, business),
    tone,
    actions: inviteeActionsFor(kase),
    ...invitationConversation(row.events ?? []),
  };
}
