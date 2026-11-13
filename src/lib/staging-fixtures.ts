import { randomBytes, scryptSync } from "crypto";
import { ensureOwnedBusinessWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";

export const STAGING_FIXTURE_KINDS = [
  "business-a",
  "business-b",
  "influencer-a",
  "influencer-b",
  "agency-owner",
  "agency-manager",
  "agency-member",
  "agency-dual",
  "admin-super",
  "admin-restricted",
] as const;

export type StagingFixtureKind = (typeof STAGING_FIXTURE_KINDS)[number];

const STAMP = /^[a-z0-9]{4,12}$/;

export function assertFixtureStamp(stamp: string): string {
  const clean = stamp.trim().toLowerCase();
  if (!STAMP.test(clean)) throw new Error("Fixture stamp must be 4 to 12 letters or digits.");
  return clean;
}

export function stagingFixtureEmail(stamp: string, kind: StagingFixtureKind): string {
  return `staging.${assertFixtureStamp(stamp)}.${kind}@example.com`;
}

export function stagingFixturePlan(stamp: string): Array<{ kind: StagingFixtureKind; email: string }> {
  const clean = assertFixtureStamp(stamp);
  return STAGING_FIXTURE_KINDS.map((kind) => ({ kind, email: stagingFixtureEmail(clean, kind) }));
}

/** Public Influrios hosts are never a place to create these accounts. */
export function stagingFixturesMayRun(input: { confirm: boolean; appHost: string | null }): { ok: true } | { ok: false; reason: string } {
  if (!input.confirm) {
    return { ok: false, reason: "Set STAGING_FIXTURES=1 to create disposable accounts." };
  }
  const host = (input.appHost ?? "").toLowerCase().split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") {
    return { ok: false, reason: "Fixtures run only against localhost, never the public host." };
  }
  return { ok: true };
}

function assertDisposableDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (/influrios\.com/i.test(url)) {
    throw new Error("Refusing to write fixtures when DATABASE_URL points at influrios.com.");
  }
}

async function member(email: string, name: string, role: "BUSINESS" | "CREATOR" | "AGENCY") {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== role) throw new Error(`Fixture ${email} already exists with a different role.`);
    return existing;
  }
  return prisma.user.create({ data: { email, name, role } });
}

export async function provisionStagingFixtures(stamp: string) {
  const clean = assertFixtureStamp(stamp);
  assertDisposableDatabase();
  const plan = stagingFixturePlan(clean);
  const email = (kind: StagingFixtureKind) => plan.find((item) => item.kind === kind)!.email;

  const businessA = await member(email("business-a"), `Staging ${clean} business A`, "BUSINESS");
  const businessB = await member(email("business-b"), `Staging ${clean} business B`, "BUSINESS");
  await ensureOwnedBusinessWorkspace(businessA.id, { name: `Staging ${clean} business A` });
  await ensureOwnedBusinessWorkspace(businessB.id, { name: `Staging ${clean} business B` });

  const influencerA = await member(email("influencer-a"), `Staging ${clean} influencer A`, "CREATOR");
  const influencerB = await member(email("influencer-b"), `Staging ${clean} influencer B`, "CREATOR");
  for (const [user, suffix] of [
    [influencerA, "a"],
    [influencerB, "b"],
  ] as const) {
    const slug = `staging-${clean}-${suffix}`;
    await prisma.creator.upsert({
      where: { userId: user.id },
      update: { slug, displayName: user.name ?? slug },
      create: { userId: user.id, slug, displayName: user.name ?? slug },
    });
  }

  const owner = await member(email("agency-owner"), `Staging ${clean} agency owner`, "AGENCY");
  const manager = await member(email("agency-manager"), `Staging ${clean} agency manager`, "AGENCY");
  const agencyMember = await member(email("agency-member"), `Staging ${clean} agency member`, "AGENCY");
  const dual = await member(email("agency-dual"), `Staging ${clean} two agencies`, "AGENCY");

  const workspaceA = `agfix${clean}a`;
  const workspaceB = `agfix${clean}b`;
  await prisma.agencyWorkspace.upsert({
    where: { id: workspaceA },
    update: { name: `Staging ${clean} agency A` },
    create: { id: workspaceA, name: `Staging ${clean} agency A` },
  });
  await prisma.agencyWorkspace.upsert({
    where: { id: workspaceB },
    update: { name: `Staging ${clean} agency B` },
    create: { id: workspaceB, name: `Staging ${clean} agency B` },
  });

  const seats: Array<{ workspaceId: string; userId: string; email: string; role: "owner" | "manager" | "member" }> = [
    { workspaceId: workspaceA, userId: owner.id, email: owner.email, role: "owner" },
    { workspaceId: workspaceA, userId: manager.id, email: manager.email, role: "manager" },
    { workspaceId: workspaceA, userId: agencyMember.id, email: agencyMember.email, role: "member" },
    { workspaceId: workspaceA, userId: dual.id, email: dual.email, role: "member" },
    { workspaceId: workspaceB, userId: dual.id, email: dual.email, role: "owner" },
  ];
  for (const seat of seats) {
    await prisma.agencySeat.upsert({
      where: { workspaceId_email: { workspaceId: seat.workspaceId, email: seat.email } },
      update: {
        role: seat.role,
        active: true,
        inviteStatus: "accepted",
        acceptedUserId: seat.userId,
        acceptedAt: new Date(),
      },
      create: {
        workspaceId: seat.workspaceId,
        email: seat.email,
        role: seat.role,
        active: true,
        inviteStatus: "accepted",
        acceptedUserId: seat.userId,
        acceptedAt: new Date(),
      },
    });
  }

  await prisma.adminRole.upsert({
    where: { id: "role_super" },
    update: {},
    create: {
      id: "role_super",
      name: "Super Admin",
      description: "Fixture bootstrap when the disposable database has no super role.",
      system: true,
      permissions: ["access.manage_users"],
    },
  });
  const restrictedRoleId = `role_fix_${clean}`;
  await prisma.adminRole.upsert({
    where: { id: restrictedRoleId },
    update: { permissions: ["invitations.view"], system: false },
    create: {
      id: restrictedRoleId,
      name: `Staging ${clean} restricted`,
      description: "Disposable restricted admin. Invitations view only.",
      system: false,
      permissions: ["invitations.view"],
    },
  });

  await adminAccount(email("admin-super"), `Staging ${clean} super admin`, "role_super", `user_fix_${clean}_super`);
  await adminAccount(email("admin-restricted"), `Staging ${clean} restricted admin`, restrictedRoleId, `user_fix_${clean}_restricted`);

  return { stamp: clean, emails: plan.map((item) => item.email), workspaceIds: [workspaceA, workspaceB] };
}

async function adminAccount(email: string, name: string, roleId: string, id: string) {
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    if (existing.roleId !== roleId) throw new Error(`Fixture admin ${email} already exists with a different role.`);
    return;
  }
  const salt = randomBytes(16).toString("hex");
  await prisma.adminUser.create({
    data: {
      id,
      email,
      name,
      roleId,
      passwordSalt: salt,
      passwordHash: scryptSync(`staging-fixture-${id}`, salt, 64).toString("hex"),
      active: true,
    },
  });
}

export async function releaseStagingFixtures(stamp: string) {
  const clean = assertFixtureStamp(stamp);
  assertDisposableDatabase();
  const emails = stagingFixturePlan(clean).map((item) => item.email);
  const memberEmails = emails.filter((value) => !value.includes(".admin-"));
  await prisma.adminUser.deleteMany({ where: { email: { in: emails } } });
  await prisma.adminRole.deleteMany({ where: { id: `role_fix_${clean}`, system: false } });
  await prisma.agencyWorkspace.deleteMany({ where: { id: { in: [`agfix${clean}a`, `agfix${clean}b`] } } });
  await prisma.creator.deleteMany({ where: { slug: { in: [`staging-${clean}-a`, `staging-${clean}-b`] } } });
  const users = await prisma.user.findMany({ where: { email: { in: memberEmails } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (userIds.length) {
    await prisma.businessWorkspace.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await prisma.businessProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
