/**
 * Authenticated HTTP journey against a running Influrios server.
 * Requires DATABASE_URL, JOURNEY_BASE_URL, and the same AUTH_SECRET the server uses.
 */
import { randomBytes } from "crypto";
import { accountSessionToken, hashAccountPassword } from "../src/lib/accounts";
import { createAdminRole, createAdminUser, loginAdmin } from "../src/lib/admin-auth";
import { ADMIN_SESSION_COOKIE } from "../src/lib/admin-session-edge";
import { creatorSessionToken } from "../src/lib/claim";
import { advanceCollaboration } from "../src/lib/collaborations";
import { prisma } from "../src/lib/db";

const base = (process.env.JOURNEY_BASE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("JOURNEY_BASE_URL is required.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

async function collaborationActionIds(cookieHeader: string) {
  const page = await fetch(`${base}/admin/collaborations`, {
    redirect: "manual",
    headers: { cookie: cookieHeader },
  });
  const html = (await page.text()).replace(/\\u002F/g, "/");
  return [...new Set(html.match(/\$ACTION_ID_([0-9a-f]{42})/g) ?? [])].map((match) =>
    match.slice("$ACTION_ID_".length),
  );
}

async function postCollaborationAction(
  cookieHeader: string,
  actionId: string,
  id: string,
  status: string,
  reason = "Journey admin correction",
) {
  const body = new FormData();
  body.set(`$ACTION_ID_${actionId}`, "");
  body.set("id", id);
  body.set("status", status);
  body.set("reason", reason);
  const response = await fetch(`${base}/admin/collaborations`, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie: cookieHeader,
    },
    body,
  });
  const text = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    body: text.slice(0, 180),
    missing: response.headers.get("x-nextjs-action-not-found") ?? "",
  };
}

async function main() {
const stamp = Date.now().toString(36);
const secretScope = `secret-scope-${stamp}`;
const secretBio = `secret-bio-${stamp}`;

function cookie(name: string, value: string) {
  return `${name}=${value}`;
}

async function statusOf(path: string, cookieHeader?: string) {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location") ?? "", body };
}

const passwordHash = hashAccountPassword(`Journey-${stamp}-password`);
const initiator = await prisma.user.create({
  data: { email: `init-${stamp}@example.com`, emailVerifiedAt: new Date(), name: "Initiator", role: "CREATOR", passwordHash },
});
const recipient = await prisma.user.create({
  data: { email: `recv-${stamp}@example.com`, emailVerifiedAt: new Date(), name: "Recipient", role: "CREATOR", passwordHash },
});
const stranger = await prisma.user.create({
  data: { email: `stranger-${stamp}@example.com`, emailVerifiedAt: new Date(), name: "Stranger", role: "CREATOR", passwordHash },
});
const business = await prisma.user.create({
  data: { email: `biz-${stamp}@example.com`, emailVerifiedAt: new Date(), name: "Business", role: "BUSINESS", passwordHash },
});
await prisma.creator.create({
  data: { userId: recipient.id, slug: `recv-${stamp}`, displayName: "Recipient" },
});
await prisma.creator.create({
  data: { userId: initiator.id, slug: `init-${stamp}`, displayName: "Initiator" },
});
const adminCollab = await prisma.collaboration.create({
  data: {
    initiatorSlug: `init-${stamp}`,
    recipientSlug: `recv-${stamp}`,
    initiatorUserId: initiator.id,
    title: `Admin journey ${stamp}`,
    scope: `admin-scope-${stamp}`,
    roleInitiator: "Brand",
    roleRecipient: "Creator",
    commercial: "Paid",
    status: "sent",
    why: "journey",
    reasons: [],
    score: 10,
  },
});
const collab = await prisma.collaboration.create({
  data: {
    initiatorSlug: `init-${stamp}`,
    recipientSlug: `recv-${stamp}`,
    initiatorUserId: initiator.id,
    title: `Journey ${stamp}`,
    scope: secretScope,
    roleInitiator: "Brand",
    roleRecipient: "Creator",
    commercial: "Paid",
    status: "sent",
    why: "journey",
    reasons: [],
    score: 10,
  },
});
const draft = await prisma.onboardingSession.create({
  data: {
    id: `draft-${stamp}`,
    inputHandle: `handle-${stamp}`,
    platform: "INSTAGRAM",
    draftSlug: `draft-${stamp}`,
    payload: { bio: secretBio, displayName: secretBio, title: "", locationCity: "", locationCountry: "", specialties: [], contentStyles: [], commercialModes: [], socials: [], image: "", coverImage: "", gender: "unspecified" },
  },
});

const failures: string[] = [];
function expect(name: string, ok: boolean, detail: string) {
  if (!ok) failures.push(`${name}: ${detail}`);
}

const adminPassword = randomBytes(18).toString("base64url");
const restrictedRole = await createAdminRole({
  name: `Restricted ${stamp}`,
  description: "Journey role without collaboration access",
  permissions: ["invitations.view"],
});
const restrictedAdmin = await createAdminUser({
  email: `restricted-${stamp}@example.com`,
  name: "Restricted Admin",
  password: adminPassword,
  roleId: restrictedRole.id,
});
const superAdmin = await createAdminUser({
  email: `super-${stamp}@example.com`,
  name: "Journey Super",
  password: adminPassword,
  roleId: "role_super",
});
const restrictedLogin = await loginAdmin(restrictedAdmin.email, adminPassword);
const superLogin = await loginAdmin(superAdmin.email, adminPassword);
if (!restrictedLogin.ok || !superLogin.ok) {
  throw new Error("Admin login failed before the HTTP checks.");
}

try {
  const anon = await statusOf(`/collaboration/records/${collab.id}`);
  expect("anonymous read", anon.status >= 300 && anon.status < 400 && anon.location.includes("/login"), `${anon.status} ${anon.location}`);
  expect("anonymous hides scope", !anon.body.includes(secretScope), "body leaked scope");

  const strangerGet = await statusOf(`/collaboration/records/${collab.id}`, cookie("influrios_account", accountSessionToken(stranger.id)));
  expect("unrelated creator", strangerGet.status === 404, String(strangerGet.status));
  expect("unrelated hides scope", !strangerGet.body.includes(secretScope), "body leaked scope");

  const businessGet = await statusOf(`/collaboration/records/${collab.id}`, cookie("influrios_account", accountSessionToken(business.id)));
  expect("unrelated business", businessGet.status === 404, String(businessGet.status));

  const initiatorGet = await statusOf(`/collaboration/records/${collab.id}`, cookie("influrios_account", accountSessionToken(initiator.id)));
  expect("initiator read", initiatorGet.status === 200 && initiatorGet.body.includes(secretScope), String(initiatorGet.status));

  const denied = await advanceCollaboration({
    id: collab.id,
    to: "accepted",
    actorUserId: initiator.id,
    actorSlug: `init-${stamp}`,
  });
  expect("initiator cannot accept", denied.ok === false, JSON.stringify(denied));
  const stillSent = await prisma.collaboration.findUnique({ where: { id: collab.id } });
  expect("denial has no write", stillSent?.status === "sent", stillSent?.status ?? "");

  const recipientGet = await statusOf(`/collaboration/records/${collab.id}`, cookie("influrios_account", accountSessionToken(recipient.id)));
  expect("recipient read", recipientGet.status === 200, String(recipientGet.status));

  const accepted = await advanceCollaboration({
    id: collab.id,
    to: "accepted",
    actorUserId: recipient.id,
    actorSlug: `recv-${stamp}`,
  });
  expect("recipient accepts once", accepted.ok === true, JSON.stringify(accepted));
  const replay = await advanceCollaboration({
    id: collab.id,
    to: "accepted",
    actorUserId: recipient.id,
    actorSlug: `recv-${stamp}`,
  });
  expect("second accept does not apply", replay.ok === false, JSON.stringify(replay));

  const preview = await statusOf(`/claim/preview/${draft.id}`);
  expect("forged draft preview", preview.status === 404 && !preview.body.includes(secretBio), String(preview.status));
  const ownedPreview = await statusOf(
    `/claim/preview/${draft.id}`,
    cookie("influrios_creator_session", creatorSessionToken(draft.id)),
  );
  expect("owner draft preview", ownedPreview.status === 200 && ownedPreview.body.includes(secretBio), String(ownedPreview.status));

  const restrictedCookie = cookie(ADMIN_SESSION_COOKIE, restrictedLogin.token);
  const superCookie = cookie(ADMIN_SESSION_COOKIE, superLogin.token);
  const restrictedAdminGet = await statusOf("/admin/collaborations", restrictedCookie);
  expect(
    "restricted admin read",
    restrictedAdminGet.status >= 300 &&
      restrictedAdminGet.status < 400 &&
      restrictedAdminGet.location.includes("error=forbidden"),
    `${restrictedAdminGet.status} ${restrictedAdminGet.location}`,
  );
  expect("restricted admin hides scope", !restrictedAdminGet.body.includes(secretScope), "body leaked scope");

  const superAdminGet = await statusOf("/admin/collaborations", superCookie);
  expect(
    "super admin read",
    superAdminGet.status === 200 && superAdminGet.body.includes(`Journey ${stamp}`),
    String(superAdminGet.status),
  );

  const actionIds = await collaborationActionIds(superCookie);
  expect("status action id", actionIds.length > 0, "no server action id on the collaborations page");
  let restrictedWrote = false;
  for (const actionId of actionIds) {
    const deniedWrite = await postCollaborationAction(restrictedCookie, actionId, adminCollab.id, "withdrawn");
    const row = await prisma.collaboration.findUnique({ where: { id: adminCollab.id } });
    if (row?.status !== "sent") restrictedWrote = true;
    expect(
      "restricted admin write denied",
      deniedWrite.status === 303 || deniedWrite.status === 307 || deniedWrite.status === 200,
      `${actionId} ${deniedWrite.status} missing=${deniedWrite.missing} ${deniedWrite.body}`,
    );
  }
  expect("restricted admin write has no side effect", !restrictedWrote, "status changed");

  for (const actionId of actionIds) {
    await postCollaborationAction(superCookie, actionId, adminCollab.id, "declined", "short");
  }
  const afterShort = await prisma.collaboration.findUnique({ where: { id: adminCollab.id } });
  expect("short admin reason does not write", afterShort?.status === "sent", afterShort?.status ?? "");
  let superWrote = false;
  const superAttempts: string[] = [];
  for (const actionId of actionIds) {
    const wrote = await postCollaborationAction(superCookie, actionId, adminCollab.id, "withdrawn");
    const rowAfter = await prisma.collaboration.findUnique({ where: { id: adminCollab.id } });
    superAttempts.push(`${wrote.status} ${wrote.location} ${rowAfter?.status}`);
    if (rowAfter?.status === "withdrawn") superWrote = true;
  }
  expect("super admin write", superWrote, superAttempts.join(" | "));

  const webhook = await fetch(`${base}/api/marketplace/webhook`, {
    method: "POST",
    headers: { "x-signature": "deadbeef", "x-timestamp": String(Math.floor(Date.now() / 1000)), "content-type": "application/json" },
    body: JSON.stringify({ id: "evt", name: "payment_intent.succeeded" }),
  });
  expect("bad airwallex signature", webhook.status === 401 || webhook.status === 503, String(webhook.status));
} finally {
  await prisma.adminUser.deleteMany({ where: { id: { in: [restrictedAdmin.id, superAdmin.id] } } }).catch(() => undefined);
  await prisma.adminRole.deleteMany({ where: { id: restrictedRole.id } }).catch(() => undefined);
  await prisma.collaboration.deleteMany({ where: { id: { in: [collab.id, adminCollab.id] } } }).catch(() => undefined);
  await prisma.onboardingSession.delete({ where: { id: draft.id } }).catch(() => undefined);
  await prisma.creator.deleteMany({ where: { slug: { in: [`init-${stamp}`, `recv-${stamp}`] } } }).catch(() => undefined);
  await prisma.businessProfile.deleteMany({ where: { userId: business.id } }).catch(() => undefined);
  await prisma.businessWorkspace.deleteMany({ where: { ownerUserId: business.id } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: { in: [initiator.id, recipient.id, stranger.id, business.id] } } }).catch(() => undefined);
  await prisma.$disconnect();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, stamp }));
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
