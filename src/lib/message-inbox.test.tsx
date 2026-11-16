import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationView } from "../app/creator/messages/conversation-view";
import { MessagesInbox, type InboxLinkProps } from "../app/creator/messages/messages-inbox";
import { prisma } from "./db";
import { memberNavActive } from "./member-nav";
import {
  appendReply,
  buildInbox,
  latestUnreadThread,
  loadMessageInbox,
  messagesForFundingMember,
  messagesHref,
  openMessageThread,
  planThreadReply,
  projectThread,
  readableContractMessages,
  replyOnThread,
  visibleInboxThreads,
  type InboxDocument,
  type InboxMessage,
  type InboxParty,
  type InboxSource,
} from "./message-inbox";

const NOW = new Date("2026-11-16T18:00:00.000Z");
const TITLE = "Launch film";
const SECRET = "private draft only for ada";

const ada = { id: "ada", email: "ada@example.com", name: "Ada Quinn" };
const cleo = { id: "cleo", email: "cleo@example.com", name: "Cleo Moss" };
const stranger = { id: "stranger", email: "stranger@example.com", name: "Someone Else" };

function person(id: string, role: string, name: string, userId: string): InboxParty {
  return { id, role, name, email: `${userId}@example.com`, userId };
}

function note(input: {
  id: string;
  documentId: string;
  body: string;
  audience: string;
  createdAt: string;
  senderUserId: string;
  senderName: string;
  recipientPartyId?: string | null;
}): InboxMessage {
  return {
    id: input.id,
    documentId: input.documentId,
    senderUserId: input.senderUserId,
    senderAdminId: null,
    senderName: input.senderName,
    body: input.body,
    audience: input.audience,
    recipientPartyId: input.recipientPartyId ?? null,
    createdAt: new Date(input.createdAt),
  };
}

const docA: InboxDocument = {
  id: "docA",
  title: TITLE,
  fundingId: "fundA",
  collaborationId: "collabA",
  parties: [
    person("brandA", "business", "North Brand", "brand"),
    person("adaA", "creator", "Ada Quinn", "ada"),
    person("cleoA", "creator", "Cleo Moss", "cleo"),
  ],
  messages: [
    note({
      id: "m-all",
      documentId: "docA",
      body: "Thanks for confirming the brief.",
      audience: "all_parties",
      createdAt: "2026-11-15T10:00:00.000Z",
      senderUserId: "brand",
      senderName: "North Brand",
    }),
    note({
      id: "m-private-a",
      documentId: "docA",
      body: SECRET,
      audience: "party",
      createdAt: "2026-11-15T11:00:00.000Z",
      senderUserId: "brand",
      senderName: "North Brand",
      recipientPartyId: "adaA",
    }),
  ],
};

const docB: InboxDocument = {
  id: "docB",
  title: TITLE,
  fundingId: "fundB",
  collaborationId: "collabB",
  parties: [
    person("brandB", "business", "North Brand", "brand"),
    person("adaB", "creator", "Ada Quinn", "ada"),
    person("cleoB", "creator", "Cleo Moss", "cleo"),
  ],
  messages: [
    note({
      id: "m-private-b",
      documentId: "docB",
      body: "Could you share the revised draft?",
      audience: "party",
      createdAt: "2026-11-16T15:00:00.000Z",
      senderUserId: "brand",
      senderName: "North Brand",
      recipientPartyId: "adaB",
    }),
  ],
};

const privateA = `party:docA:${["adaA", "brandA"].sort().join(":")}`;
const privateB = `party:docB:${["adaB", "brandB"].sort().join(":")}`;
const sources: InboxSource[] = [
  { via: "contract", document: docA },
  { via: "collaboration", document: { ...docA, messages: [...docA.messages] } },
  { via: "collaboration", document: docB },
  { via: "contract", document: { ...docB, messages: [...docB.messages] } },
];
const reads = [{ threadId: privateA, readAt: new Date("2026-11-16T12:00:00.000Z") }];

function adaInbox() {
  return buildInbox({ sources, account: ada, reads, now: NOW });
}

function StubLink(props: InboxLinkProps) {
  return (
    <a
      href={props.href}
      data-scroll={String(props.scroll)}
      className={props.className}
      aria-label={props["aria-label"]}
      aria-current={props["aria-current"]}
    >
      {props.children}
    </a>
  );
}

function hrefs(html: string) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

describe("message threads", () => {
  it("lists a contract and its collaboration once, and keeps same-title private threads apart", () => {
    const threads = adaInbox();
    assert.equal(threads.filter((thread) => thread.id === "all:docA").length, 1);
    assert.equal(new Set(threads.map((thread) => thread.id)).size, threads.length);
    const privates = threads.filter((thread) => thread.id.startsWith("party:"));
    assert.deepEqual(
      privates.map((thread) => thread.id).sort(),
      [privateA, privateB].sort(),
    );
    assert.notEqual(privates[0].contractRef, privates[1].contractRef);
    assert.deepEqual(privates[0].participants, ["North Brand", "Ada Quinn"]);
    assert.deepEqual(privates[1].participants, ["North Brand", "Ada Quinn"]);
    const shared = threads.find((thread) => thread.id === "all:docA");
    assert.deepEqual(shared?.participants, ["North Brand", "Ada Quinn", "Cleo Moss"]);
    assert.equal(shared?.contractRef, "docA");
    assert.equal(threads.every((thread) => thread.sharedTitle), true);
    assert.equal(threads[0].id, privateB);
    assert.match(threads[0].previewLine, /North Brand: Could you share the revised draft\?/);
  });

  it("rejects a non-member load or reply and hides the message text", () => {
    const cleoThreads = buildInbox({ sources, account: cleo, reads: [], now: NOW });
    assert.deepEqual(
      cleoThreads.map((thread) => thread.id),
      ["all:docA"],
    );
    assert.equal(JSON.stringify(cleoThreads).includes(SECRET), false);
    assert.equal(buildInbox({ sources, account: stranger, reads: [], now: NOW }).length, 0);

    const documents = [docA, docB];
    for (const account of [cleo, stranger]) {
      const opened = projectThread({ documents, account, threadId: privateB, now: NOW });
      const reply = planThreadReply({
        documents,
        account,
        threadId: privateB,
        body: "I should not send this",
        now: NOW,
      });
      assert.equal(opened.ok, false);
      assert.equal(reply.ok, false);
      if (!opened.ok) assert.equal(opened.error, "You cannot read this conversation.");
      if (!reply.ok) assert.equal(reply.error, "You cannot reply to this conversation.");
      assert.equal(JSON.stringify(opened).includes("revised draft"), false);
      assert.equal(JSON.stringify(reply).includes(SECRET), false);
    }
    const swapped = `party:docB:${["brandB", "adaB"].sort().reverse().join(":")}`;
    assert.notEqual(swapped, privateB);
    assert.equal(projectThread({ documents, account: ada, threadId: swapped, now: NOW }).ok, false);
    const cleoShared = projectThread({ documents, account: cleo, threadId: "all:docA", now: NOW });
    assert.equal(cleoShared.ok, true);
  });

  it("lets an influencer answer the latest unread thread and see that reply on the collaboration", () => {
    const threads = adaInbox();
    const latest = latestUnreadThread(threads);
    assert.equal(latest?.id, privateB);
    assert.equal(latest?.unread, true);
    assert.deepEqual(
      visibleInboxThreads(threads, "unread", "revised draft").map((thread) => thread.id),
      [privateB],
    );
    assert.equal(visibleInboxThreads(threads, "unread", "").some((thread) => thread.id === privateA), false);

    const opened = projectThread({ documents: [docA, docB], account: ada, threadId: latest!.id, now: NOW });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    assert.equal(opened.view.replyRecipients, "North Brand will receive this reply.");
    assert.equal(opened.view.visibleTo, "Visible to: North Brand and Ada Quinn");
    assert.equal(opened.view.contractHref, "/collaboration/contracts/docB");
    assert.match(opened.view.messages.map((message) => message.body).join("\n"), /Could you share the revised draft\?/);

    const planned = planThreadReply({
      documents: [docA, docB],
      account: ada,
      threadId: latest!.id,
      body: "Sending the revised draft.",
      now: new Date("2026-11-16T18:05:00.000Z"),
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.message.audience, "party");
    assert.equal(planned.message.recipientPartyId, "brandB");
    const next = appendReply([docA, docB], planned.message);
    const workspace = readableContractMessages(next.find((document) => document.fundingId === "fundB")!, {
      kind: "party",
      userId: ada.id,
      partyId: "adaB",
    });
    assert.equal(
      workspace.some((message) => message.body === "Sending the revised draft." && message.threadId === privateB),
      true,
    );
    const after = buildInbox({
      sources: next.map((document) => ({ via: "contract", document })),
      account: ada,
      reads,
      now: NOW,
    });
    const row = after.find((thread) => thread.id === privateB);
    assert.match(row?.previewLine ?? "", /^You: Sending the revised draft\./);
    assert.equal(row?.unread, false);
    const back = messagesHref({ filter: "unread", q: "draft" });
    assert.equal(back.includes("thread"), false);
    assert.match(back, /filter=unread/);
    assert.match(back, /q=draft/);
    assert.equal(planThreadReply({ documents: [docA, docB], account: ada, threadId: privateB, body: "  ", now: NOW }).ok, false);
  });
});

describe("messages inbox screen", () => {
  it("highlights Messages and leaves Dashboard for the exact home", () => {
    assert.equal(memberNavActive("/creator", "/creator/messages"), false);
    assert.equal(memberNavActive("/creator/messages", "/creator/messages"), true);
    assert.equal(memberNavActive("/creator", "/creator"), true);
    assert.equal(memberNavActive("/dashboard", "/creator/messages"), false);
    assert.equal(memberNavActive("/collaboration/contracts", "/creator/messages"), false);
    assert.equal(memberNavActive("/collaboration/hub?view=collaborations", "/collaboration/work/fundB"), true);
    assert.equal(memberNavActive("/creator/messages", "/collaboration/work/fundB"), false);
    const shell = readFileSync("src/components/account-shell.tsx", "utf8");
    assert.match(shell, /memberNavActive\(item\.href, path, search\)/);
    assert.match(shell, /href: "\/creator\/messages", label: "Messages"/);
    assert.match(shell, /aria-current=\{on \? "page" : undefined\}/);
  });

  it("renders the list, the reply audience, and the way back to the same filter", () => {
    const threads = adaInbox();
    const html = renderToStaticMarkup(
      <MessagesInbox
        threads={threads}
        failed={false}
        filter="all"
        q=""
        activeThreadId={privateB}
        dimmed
        linkComponent={StubLink}
      />,
    );
    assert.match(html, /data-inbox-dimmed="true"/);
    assert.match(html, /Messages/);
    assert.match(html, /Search conversations/);
    assert.match(html, />All</);
    assert.match(html, />Unread</);
    assert.match(html, /North Brand, Ada Quinn, Cleo Moss · docA/);
    assert.match(html, /North Brand, Ada Quinn · docA/);
    assert.match(html, /North Brand, Ada Quinn · docB/);
    assert.match(html, /North Brand: Could you share the revised draft\?/);
    assert.match(html, /data-thread-id="all:docA"/);
    assert.match(html, new RegExp(`data-thread-id="${privateA}"`));
    assert.match(html, new RegExp(`data-thread-id="${privateB}"`));
    assert.match(html, /data-scroll="false"/);
    assert.equal(html.includes("loadCreatorHub"), false);

    const unread = renderToStaticMarkup(
      <MessagesInbox threads={threads} failed={false} filter="unread" q="draft" activeThreadId="" dimmed={false} linkComponent={StubLink} />,
    );
    assert.equal(unread.includes(SECRET), false);
    assert.match(unread, /Could you share the revised draft\?/);
    assert.ok(hrefs(unread).includes(messagesHref({ filter: "unread", q: "draft", thread: privateB })));

    const opened = projectThread({ documents: [docA, docB], account: ada, threadId: privateB, now: NOW });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const closeHref = messagesHref({ filter: "unread", q: "draft" });
    const popup = renderToStaticMarkup(
      <ConversationView titleId="conversation-title" closeHref={closeHref} state={opened} />,
    );
    assert.match(popup, /role="dialog"|North Brand will receive this reply/);
    assert.match(popup, /North Brand will receive this reply\./);
    assert.match(popup, /Visible to: North Brand and Ada Quinn/);
    assert.match(popup, /View contract/);
    assert.match(popup, /Back to messages/);
    assert.match(popup, />Send</);
    assert.match(popup, /Write a message/);
    assert.match(popup, /Could you share the revised draft\?/);
    assert.equal(popup.includes('name="audience"'), false);
    assert.ok(hrefs(popup).includes(closeHref));
    assert.ok(hrefs(popup).includes("/collaboration/contracts/docB"));
    assert.match(popup, /data-scroll="false"/);

    const rejected = renderToStaticMarkup(
      <ConversationView
        titleId="conversation-title"
        closeHref={closeHref}
        state={{ ok: false, error: "You cannot read this conversation." }}
      />,
    );
    assert.match(rejected, /You cannot read this conversation/);
    assert.match(rejected, /Back to messages/);
    assert.equal(rejected.includes(">Send<"), false);
    assert.equal(rejected.includes(SECRET), false);
    assert.equal(rejected.includes("revised draft"), false);
  });

  it("shows an unavailable list separately from an empty one", () => {
    const failed = renderToStaticMarkup(
      <MessagesInbox threads={[]} failed filter="all" q="" activeThreadId="" dimmed={false} linkComponent={StubLink} />,
    );
    const empty = renderToStaticMarkup(
      <MessagesInbox threads={[]} failed={false} filter="all" q="" activeThreadId="" dimmed={false} linkComponent={StubLink} />,
    );
    assert.match(failed, /This is not an empty inbox/);
    assert.match(empty, /No conversations yet/);
    assert.equal(empty.includes("This is not an empty inbox"), false);
  });

  it("keeps the page, the reply, and the workspace on the same thread rules", () => {
    const page = readFileSync("src/app/creator/messages/page.tsx", "utf8");
    const inbox = readFileSync("src/app/creator/messages/messages-inbox.tsx", "utf8");
    const popup = readFileSync("src/app/creator/messages/conversation-popup.tsx", "utf8");
    const view = readFileSync("src/app/creator/messages/conversation-view.tsx", "utf8");
    const actions = readFileSync("src/app/creator/messages/actions.ts", "utf8");
    const panel = readFileSync("src/app/collaboration/work/[fundingId]/messages-panel.tsx", "utf8");
    const lib = readFileSync("src/lib/message-inbox.ts", "utf8");
    const access = readFileSync("src/lib/contract-document.ts", "utf8");
    assert.match(page, /export default async function CreatorMessagesPage/);
    assert.equal(page.includes("export function"), false);
    assert.equal(page.includes("export const "), true);
    assert.equal(page.includes("loadCreatorHub"), false);
    assert.equal(page.includes("pipeline"), false);
    assert.match(page, /loadMessageInbox/);
    assert.match(page, /openMessageThread/);
    assert.match(page, /next-router-prefetch/);
    assert.match(inbox, /scroll=\{false\}/);
    assert.match(inbox, /prefetch=\{false\}/);
    assert.match(popup, /useAccountDialogBehavior/);
    assert.match(popup, /role="dialog"/);
    assert.match(popup, /aria-modal="true"/);
    assert.match(popup, /scroll=\{false\}/);
    assert.match(popup, /absolute inset-0/);
    assert.match(popup, /md:left-1\/2/);
    assert.match(view, /md:hidden/);
    assert.match(view, /Back to messages/);
    assert.match(view, /View contract/);
    assert.equal(view.includes('name="audience"'), false);
    assert.match(actions, /getAccountSession/);
    assert.match(actions, /replyOnThread/);
    assert.equal(actions.includes("audience"), false);
    assert.match(panel, /readableContractMessages/);
    assert.match(panel, /id="messages"/);
    assert.match(panel, /data-thread-id=\{message\.threadId\}/);
    assert.match(lib, /messageVisible/);
    assert.match(access, /You cannot message on this contract/);
    assert.equal(lib.includes("grossCents"), false);
    assert.equal(lib.includes("feeCents"), false);
    assert.equal(lib.includes("payout"), false);
    for (const source of [page, inbox, popup, view, actions, lib]) {
      assert.equal(source.toLowerCase().includes("tax"), false);
    }
  });
});

async function databaseReady() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("messages inbox with a database", () => {
  it("stores one shared thread, separate private threads, and rejects a non-member", async (t) => {
    if (!(await databaseReady())) {
      t.skip("DATABASE_URL is not available");
      return;
    }
    const stamp = Date.now().toString(36);
    const title = `Launch ${stamp}`;
    const userIds: string[] = [];
    const documentIds: string[] = [];
    const brand = await prisma.user.create({
      data: { email: `brand-${stamp}@example.com`, name: "North Brand", role: "BUSINESS" },
    });
    const influencer = await prisma.user.create({
      data: { email: `ada-${stamp}@example.com`, name: "Ada Quinn", role: "CREATOR" },
    });
    const other = await prisma.user.create({
      data: { email: `cleo-${stamp}@example.com`, name: "Cleo Moss", role: "CREATOR" },
    });
    const outsider = await prisma.user.create({
      data: { email: `stranger-${stamp}@example.com`, name: "Someone Else", role: "CREATOR" },
    });
    userIds.push(brand.id, influencer.id, other.id, outsider.id);
    try {
      const first = await prisma.contractDocument.create({
        data: {
          title,
          renderedBody: "Agreement A",
          pdfBytes: Buffer.from("%PDF-1.4"),
          status: "signed",
          fundingId: `fund-a-${stamp}`,
          parties: {
            create: [
              { role: "business", name: "North Brand", email: brand.email, userId: brand.id },
              { role: "creator", name: "Ada Quinn", email: influencer.email, userId: influencer.id },
              { role: "creator", name: "Cleo Moss", email: other.email, userId: other.id },
            ],
          },
        },
        include: { parties: true },
      });
      const second = await prisma.contractDocument.create({
        data: {
          title,
          renderedBody: "Agreement B",
          pdfBytes: Buffer.from("%PDF-1.4"),
          status: "signed",
          fundingId: `fund-b-${stamp}`,
          parties: {
            create: [
              { role: "business", name: "North Brand", email: brand.email, userId: brand.id },
              { role: "creator", name: "Ada Quinn", email: influencer.email, userId: influencer.id },
              { role: "creator", name: "Cleo Moss", email: other.email, userId: other.id },
            ],
          },
        },
        include: { parties: true },
      });
      documentIds.push(first.id, second.id);
      const brandA = first.parties.find((party) => party.userId === brand.id)!;
      const adaA = first.parties.find((party) => party.userId === influencer.id)!;
      const brandB = second.parties.find((party) => party.userId === brand.id)!;
      const adaB = second.parties.find((party) => party.userId === influencer.id)!;
      const olderPrivate = `party:${first.id}:${[adaA.id, brandA.id].sort().join(":")}`;
      const newerPrivate = `party:${second.id}:${[adaB.id, brandB.id].sort().join(":")}`;
      await prisma.contractMessage.createMany({
        data: [
          {
            documentId: first.id,
            senderUserId: brand.id,
            senderName: "North Brand",
            body: "Thanks for confirming the brief.",
            audience: "all_parties",
            createdAt: new Date("2026-11-15T10:00:00.000Z"),
          },
          {
            documentId: first.id,
            senderUserId: brand.id,
            senderName: "North Brand",
            body: SECRET,
            audience: "party",
            recipientPartyId: adaA.id,
            createdAt: new Date("2026-11-15T11:00:00.000Z"),
          },
          {
            documentId: second.id,
            senderUserId: brand.id,
            senderName: "North Brand",
            body: "Could you share the revised draft?",
            audience: "party",
            recipientPartyId: adaB.id,
            createdAt: new Date("2026-11-16T15:00:00.000Z"),
          },
        ],
      });
      await prisma.messageThreadRead.create({
        data: { userId: influencer.id, threadId: olderPrivate, readAt: new Date("2026-11-16T12:00:00.000Z") },
      });

      const account = { id: influencer.id, email: influencer.email, name: influencer.name };
      const inbox = await loadMessageInbox(account, NOW);
      assert.equal(inbox.ok, true);
      if (!inbox.ok) return;
      assert.equal(inbox.threads.filter((thread) => thread.id === `all:${first.id}`).length, 1);
      const privates = inbox.threads.filter((thread) => thread.id.startsWith("party:"));
      assert.equal(privates.length, 2);
      assert.notEqual(privates[0].contractRef, privates[1].contractRef);
      assert.equal(latestUnreadThread(inbox.threads)?.id, newerPrivate);
      assert.equal(JSON.stringify(inbox.threads.filter((thread) => thread.id !== olderPrivate)).includes(SECRET), false);

      const before = await prisma.contractMessage.count({ where: { documentId: { in: documentIds } } });
      const cleoReply = await replyOnThread({
        account: { id: other.id, email: other.email, name: other.name },
        threadId: newerPrivate,
        body: "I should not send this",
      });
      const outsiderOpen = await openMessageThread(
        { id: outsider.id, email: outsider.email },
        newerPrivate,
      );
      assert.equal(cleoReply.ok, false);
      assert.equal(outsiderOpen.ok, false);
      if (!outsiderOpen.ok) assert.equal(outsiderOpen.error, "You cannot read this conversation.");
      assert.equal(JSON.stringify(cleoReply).includes("revised draft"), false);
      assert.equal(JSON.stringify(outsiderOpen).includes(SECRET), false);
      assert.equal(await prisma.contractMessage.count({ where: { documentId: { in: documentIds } } }), before);

      const opened = await openMessageThread(account, newerPrivate, NOW);
      assert.equal(opened.ok, true);
      if (!opened.ok) return;
      assert.equal(opened.view.replyRecipients, "North Brand will receive this reply.");
      const sent = await replyOnThread({ account, threadId: newerPrivate, body: "Sending the revised draft." });
      assert.equal(sent.ok, true);
      if (!sent.ok) return;
      assert.equal(sent.threadId, newerPrivate);
      const workspace = await messagesForFundingMember(`fund-b-${stamp}`, account);
      assert.equal(workspace.ok, true);
      if (!workspace.ok) return;
      assert.equal(
        workspace.messages.some((message) => message.body === "Sending the revised draft." && message.threadId === newerPrivate),
        true,
      );
      const again = await projectThread({
        documents: [
          {
            id: second.id,
            title,
            fundingId: `fund-b-${stamp}`,
            parties: second.parties,
            messages: workspace.messages,
          },
        ],
        account,
        threadId: newerPrivate,
        now: new Date("2026-11-16T18:10:00.000Z"),
      });
      assert.equal(again.ok, true);
      if (again.ok) assert.match(again.view.messages.map((message) => message.body).join("\n"), /Sending the revised draft\./);
    } finally {
      if (userIds.length) {
        await prisma.messageThreadRead.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      }
      if (documentIds.length) {
        await prisma.contractDocument.deleteMany({ where: { id: { in: documentIds } } }).catch(() => undefined);
      }
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
      }
    }
  });
});
