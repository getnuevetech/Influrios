/**
 * Seed disposable AUDIT_* fixtures into the local-only Postgres database.
 * Refuses any DATABASE_URL that looks like the public host.
 */
import { createHash, randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { ensureOwnedBusinessWorkspace } from "../../src/lib/business";
import { ensureLaunchEntitlements } from "../../src/lib/entitlements-db";

const prisma = new PrismaClient();
const RUN = process.env.AUDIT_RUN_STAMP || `r3${Date.now().toString(36).slice(-6)}`;

function assertLocalDisposableDb() {
  const url = process.env.DATABASE_URL || "";
  if (!url) throw new Error("DATABASE_URL missing");
  if (/influrios\.com/i.test(url)) throw new Error("Refusing: DATABASE_URL looks like public host");
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Refusing: DATABASE_URL must be localhost");
}

function hashAccountPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function hashAdminPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

async function upsertMember(input: {
  email: string;
  name: string;
  role: "BUSINESS" | "CREATOR";
  password: string;
}) {
  const passwordHash = hashAccountPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        role: input.role,
        passwordHash,
        emailVerifiedAt: new Date(),
        planTier: existing.planTier || "STARTER",
      },
    });
  }
  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash,
      emailVerifiedAt: new Date(),
      planTier: "STARTER",
    },
  });
}

async function main() {
  assertLocalDisposableDb();
  await ensureLaunchEntitlements();

  const password = process.env.AUDIT_LOCAL_PASSWORD || "AuditLocalPass!2026";
  const bizA = await upsertMember({
    email: `audit.${RUN}.business-a@example.com`,
    name: `AUDIT ${RUN} Business A`,
    role: "BUSINESS",
    password,
  });
  const bizB = await upsertMember({
    email: `audit.${RUN}.business-b@example.com`,
    name: `AUDIT ${RUN} Business B`,
    role: "BUSINESS",
    password,
  });
  await ensureOwnedBusinessWorkspace(bizA.id, { name: `AUDIT ${RUN} Co A` });
  await ensureOwnedBusinessWorkspace(bizB.id, { name: `AUDIT ${RUN} Co B` });

  const infA = await upsertMember({
    email: `audit.${RUN}.influencer-a@example.com`,
    name: `AUDIT ${RUN} Influencer A`,
    role: "CREATOR",
    password,
  });
  const infB = await upsertMember({
    email: `audit.${RUN}.influencer-b@example.com`,
    name: `AUDIT ${RUN} Influencer B`,
    role: "CREATOR",
    password,
  });
  const infUnrelated = await upsertMember({
    email: `audit.${RUN}.influencer-unrelated@example.com`,
    name: `AUDIT ${RUN} Unrelated`,
    role: "CREATOR",
    password,
  });

  for (const [user, suffix] of [
    [infA, "a"],
    [infB, "b"],
    [infUnrelated, "u"],
  ] as const) {
    const slug = `audit-${RUN}-${suffix}`;
    const existingCreator = await prisma.creator.findFirst({ where: { user: { id: user.id } } });
    if (existingCreator) {
      await prisma.creator.update({
        where: { id: existingCreator.id },
        data: {
          slug,
          displayName: user.name ?? slug,
          claimed: true,
          profileState: "CLAIMED",
        },
      });
    } else {
      await prisma.creator.create({
        data: {
          slug,
          displayName: user.name ?? slug,
          claimed: true,
          profileState: "CLAIMED",
          user: { connect: { id: user.id } },
        },
      });
    }
  }

  await prisma.adminRole.upsert({
    where: { id: "role_super" },
    update: {},
    create: {
      id: "role_super",
      name: "Super Admin",
      description: "Local audit bootstrap",
      system: true,
      permissions: ["*"],
    },
  });
  const limitedRoleId = `role_audit_${RUN}_limited`;
  await prisma.adminRole.upsert({
    where: { id: limitedRoleId },
    update: { permissions: ["invitations.view"] },
    create: {
      id: limitedRoleId,
      name: `AUDIT ${RUN} limited`,
      description: "Limited admin for denial tests",
      system: false,
      permissions: ["invitations.view"],
    },
  });

  const adminEmail = process.env.ADMIN_SUPER_EMAIL || "audit.admin@example.com";
  const adminPassword = process.env.ADMIN_SUPER_PASSWORD || password;
  const salt = randomBytes(16).toString("hex");
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        id: `admin_audit_${RUN}`,
        email: adminEmail,
        name: `AUDIT ${RUN} Super`,
        roleId: "role_super",
        passwordSalt: salt,
        passwordHash: hashAdminPassword(adminPassword, salt),
        active: true,
      },
    });
  } else {
    await prisma.adminUser.update({
      where: { id: existingAdmin.id },
      data: {
        passwordSalt: salt,
        passwordHash: hashAdminPassword(adminPassword, salt),
        active: true,
        roleId: "role_super",
      },
    });
  }

  const limitedEmail = `audit.${RUN}.admin-limited@example.com`;
  const limitedSalt = randomBytes(16).toString("hex");
  await prisma.adminUser.upsert({
    where: { email: limitedEmail },
    update: {
      roleId: limitedRoleId,
      passwordSalt: limitedSalt,
      passwordHash: hashAdminPassword(password, limitedSalt),
      active: true,
    },
    create: {
      id: `admin_audit_${RUN}_lim`,
      email: limitedEmail,
      name: `AUDIT ${RUN} Limited`,
      roleId: limitedRoleId,
      passwordSalt: limitedSalt,
      passwordHash: hashAdminPassword(password, limitedSalt),
      active: true,
    },
  });

  // Mail settings → Mailpit
  await prisma.mailSettings.upsert({
    where: { id: "default" },
    update: {
      host: "127.0.0.1",
      port: 1025,
      fromAddress: "noreply@audit.local",
      fromName: "Influrios Audit",
      enabled: true,
      username: "",
      // leave password empty for open Mailpit
    },
    create: {
      id: "default",
      host: "127.0.0.1",
      port: 1025,
      fromAddress: "noreply@audit.local",
      fromName: "Influrios Audit",
      enabled: true,
      username: "",
    },
  }).catch(async () => {
    // schema may use different model name — ignore if absent
  });

  const out = {
    run: RUN,
    passwordEnv: "AUDIT_LOCAL_PASSWORD or default",
    members: {
      businessA: bizA.email,
      businessB: bizB.email,
      influencerA: infA.email,
      influencerB: infB.email,
      influencerUnrelated: infUnrelated.email,
    },
    admin: { super: adminEmail, limited: limitedEmail },
    ids: {
      businessA: bizA.id,
      businessB: bizB.id,
      influencerA: infA.id,
      influencerB: infB.id,
      influencerUnrelated: infUnrelated.id,
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
