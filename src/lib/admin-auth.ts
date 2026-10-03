/**
 * Admin access control — cookie sessions + Postgres roles/permissions.
 * Super admin can create access levels from granular feature permissions.
 * One-time import from data/admin-auth.json when the DB tables are empty.
 */
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "crypto";
import { promises as fs } from "fs";
import { cookies, headers } from "next/headers";
import path from "path";
import { prisma } from "@/lib/db";

/** Granular feature permissions selectable when creating an access level. */
export const ADMIN_PERMISSIONS = [
  "banners.view",
  "banners.edit",
  "cards.view",
  "cards.edit",
  "matching.view",
  "matching.manage_optins",
  "matching.create_intros",
  "matching.advance_intros",
  "intelligence.view",
  "intelligence.export",
  "billing.view",
  "plans.view",
  "plans.edit",
  "taxonomy.view",
  "taxonomy.edit",
  "payments.view",
  "payments.manage",
  "trust.view",
  "trust.mediate",
  "agency.view",
  "agency.manage",
  "commerce.view",
  "commerce.manage",
  "access.manage_roles",
  "access.manage_users",
  "accounts.view",
  "accounts.edit",
  "invitations.view",
  "invitations.edit",
  "collaborations.view",
  "collaborations.edit",
  "ai.view",
  "ai.edit",
  "gateways.view",
  "gateways.edit",
  "signing.view",
  "signing.edit",
  "social.view",
  "social.edit",
  "legal.view",
  "legal.edit",
  "shortlinks.view",
  "shortlinks.edit",
  "mail.view",
  "mail.edit",
  "jobs.view",
  "jobs.retry",
  "marketplace.view",
  "marketplace.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminModule =
  | "banners"
  | "cards"
  | "matching"
  | "intelligence"
  | "billing"
  | "plans"
  | "taxonomy"
  | "payments"
  | "trust"
  | "agency"
  | "commerce"
  | "access"
  | "accounts"
  | "invitations"
  | "collaborations"
  | "ai"
  | "gateways"
  | "signing"
  | "social"
  | "legal"
  | "shortlinks"
  | "mail"
  | "jobs"
  | "marketplace";

export const ADMIN_PERMISSION_GROUPS: {
  module: AdminModule;
  label: string;
  description: string;
  permissions: { id: AdminPermission; label: string; hint: string }[];
}[] = [
  {
    module: "banners",
    label: "Banners",
    description: "Landing hero, sponsored, card promo, and CTA banners",
    permissions: [
      { id: "banners.view", label: "View banners", hint: "Open the banners console" },
      { id: "banners.edit", label: "Edit banners", hint: "Update copy, CTAs, and uploads" },
    ],
  },
  {
    module: "cards",
    label: "Influencer cards",
    description: "Featured card sizing and per-creator feature toggles",
    permissions: [
      { id: "cards.view", label: "View cards CMS", hint: "Open the cards console" },
      { id: "cards.edit", label: "Edit cards CMS", hint: "Change globals and card flags" },
    ],
  },
  {
    module: "matching",
    label: "Managed matching",
    description: "Influencer opt-in, shortlist intros, and pipeline status",
    permissions: [
      { id: "matching.view", label: "View matching", hint: "See opt-ins and intro pipeline" },
      { id: "matching.manage_optins", label: "Manage opt-ins", hint: "Toggle influencer managed opt-in" },
      { id: "matching.create_intros", label: "Create intros", hint: "Deliver shortlist → create intro" },
      { id: "matching.advance_intros", label: "Advance intros", hint: "Move intro status / mark paid" },
    ],
  },
  {
    module: "intelligence",
    label: "Intelligence",
    description: "Audience snapshots, trends, and relationship signals",
    permissions: [
      { id: "intelligence.view", label: "View intelligence", hint: "Open intelligence console" },
      { id: "intelligence.export", label: "Export intelligence", hint: "Hit JSON/CSV export API from admin" },
    ],
  },
  {
    module: "billing",
    label: "Billing",
    description: "Plan catalog and checkout session history",
    permissions: [
      { id: "billing.view", label: "View billing", hint: "Open billing ops console" },
    ],
  },
  {
    module: "plans",
    label: "Plan entitlements",
    description: "Database-backed card limits. These values drive the live card.",
    permissions: [
      { id: "plans.view", label: "View plan limits", hint: "Open the entitlement matrix" },
      { id: "plans.edit", label: "Edit plan limits", hint: "Change feature limits and record an audit entry" },
    ],
  },
  {
    module: "taxonomy",
    label: "Taxonomy",
    description: "Specialty tree, active state, and search synonyms",
    permissions: [
      { id: "taxonomy.view", label: "View taxonomy", hint: "Open specialties and synonyms" },
      { id: "taxonomy.edit", label: "Edit taxonomy", hint: "Enable specialties and add synonyms" },
    ],
  },
  {
    module: "payments",
    label: "Protected payments",
    description: "Escrow deals, milestone release, and refunds",
    permissions: [
      { id: "payments.view", label: "View payments", hint: "Open escrow console" },
      { id: "payments.manage", label: "Manage payments", hint: "Create deals, fund, release, refund" },
    ],
  },
  {
    module: "trust",
    label: "Trust & disputes",
    description: "Mediation queue and collab contract briefs",
    permissions: [
      { id: "trust.view", label: "View trust", hint: "Open disputes & contracts console" },
      { id: "trust.mediate", label: "Mediate disputes", hint: "Advance cases and attach contracts" },
    ],
  },
  {
    module: "agency",
    label: "Agency",
    description: "Talent roster, campaigns, and joint portfolios",
    permissions: [
      { id: "agency.view", label: "View agency", hint: "Open agency ops console" },
      { id: "agency.manage", label: "Manage agency", hint: "Edit roster, campaigns, portfolios" },
    ],
  },
  {
    module: "commerce",
    label: "Collaboration fees",
    description: "Fee matrix, simulator, and immutable commercial snapshots",
    permissions: [
      { id: "commerce.view", label: "View fee rules", hint: "Open commission / fee console" },
      { id: "commerce.manage", label: "Manage fee rules", hint: "Edit rules, run simulator, freeze snapshots" },
    ],
  },
  {
    module: "marketplace",
    label: "Marketplace ledger",
    description: "Prefunding, milestone templates, and the provider-held ledger",
    permissions: [
      { id: "marketplace.view", label: "View marketplace ledger", hint: "Open prefund and milestone records" },
      { id: "marketplace.manage", label: "Manage marketplace ledger", hint: "Edit jurisdictions, templates, and the provider" },
    ],
  },
  {
    module: "accounts",
    label: "Member accounts",
    description: "Registered members, consent version, and password rules",
    permissions: [
      { id: "accounts.view", label: "View accounts", hint: "Open member accounts and consent settings" },
      { id: "accounts.edit", label: "Edit accounts", hint: "Verify, suspend, and change account policy" },
    ],
  },
  {
    module: "invitations",
    label: "Invitations",
    description: "Claim links, templates, campaigns, and do-not-contact",
    permissions: [
      { id: "invitations.view", label: "View invitations", hint: "Open the outreach queue" },
      { id: "invitations.edit", label: "Edit invitations", hint: "Queue links, edit templates, suppress contacts" },
    ],
  },
  {
    module: "collaborations",
    label: "Collaborations",
    description: "Proposal records, the rate-limit window, and commercial options",
    permissions: [
      { id: "collaborations.view", label: "View collaborations", hint: "Open proposal records" },
      { id: "collaborations.edit", label: "Edit collaborations", hint: "Change status, window, and commercial options" },
    ],
  },
  {
    module: "ai",
    label: "AI pipelines",
    description: "Model providers and which pipeline function each one serves",
    permissions: [
      { id: "ai.view", label: "View AI pipelines", hint: "Open providers and function assignments" },
      { id: "ai.edit", label: "Edit AI pipelines", hint: "Save API details and assign functions" },
    ],
  },
  {
    module: "gateways",
    label: "Payment gateways",
    description: "Gateway credentials and the country each one serves",
    permissions: [
      { id: "gateways.view", label: "View gateways", hint: "Open country routes and credentials" },
      { id: "gateways.edit", label: "Edit gateways", hint: "Save secrets and assign countries" },
    ],
  },
  {
    module: "signing",
    label: "Document signing",
    description: "Signing API used after a collaboration is accepted",
    permissions: [
      { id: "signing.view", label: "View signing", hint: "Open the signing API and requests" },
      { id: "signing.edit", label: "Edit signing", hint: "Save API details" },
    ],
  },
  {
    module: "social",
    label: "Social networks",
    description: "Live account connections, follower and like sync, and the influencer terms",
    permissions: [
      { id: "social.view", label: "View social networks", hint: "Open network connections and the integration terms" },
      { id: "social.edit", label: "Edit social networks", hint: "Save API details and the terms influencers must accept" },
    ],
  },
  {
    module: "legal",
    label: "Legal documents",
    description: "Versioned terms and policies, publication, and the acceptance ledger",
    permissions: [
      { id: "legal.view", label: "View legal documents", hint: "Open the legal document manager" },
      { id: "legal.edit", label: "Edit legal documents", hint: "Draft, publish, supersede, and require re-acceptance" },
    ],
  },
  {
    module: "shortlinks",
    label: "Short links",
    description: "inflr.me domains, reserved slugs, suspensions, and abuse",
    permissions: [
      { id: "shortlinks.view", label: "View short links", hint: "Open domains, slugs, and audit events" },
      { id: "shortlinks.edit", label: "Edit short links", hint: "Reserve, suspend, and update domains" },
    ],
  },
  {
    module: "mail",
    label: "Email",
    description: "SMTP host, from address, and the claim invitation test send",
    permissions: [
      { id: "mail.view", label: "View email", hint: "Open SMTP settings" },
      { id: "mail.edit", label: "Edit email", hint: "Save SMTP and send a test" },
    ],
  },
  {
    module: "jobs",
    label: "Jobs",
    description: "Queued mail and provider jobs, including retry",
    permissions: [
      { id: "jobs.view", label: "View jobs", hint: "Open the job list" },
      { id: "jobs.retry", label: "Retry jobs", hint: "Queue a failed job again" },
    ],
  },
  {
    module: "access",
    label: "Access control",
    description: "Create roles and admin users (typically Super Admin)",
    permissions: [
      { id: "access.manage_roles", label: "Manage roles", hint: "Create access levels / permission sets" },
      { id: "access.manage_users", label: "Manage users", hint: "Invite admins, set roles, enable/disable" },
    ],
  },
];

export type AdminRole = {
  id: string;
  name: string;
  description: string;
  permissions: AdminPermission[];
  system?: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuthStore = {
  roles: AdminRole[];
  users: AdminUser[];
};

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: AdminPermission[];
  exp: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const LEGACY_STORE_PATH = path.join(DATA_DIR, "admin-auth.json");
const LEGACY_MIGRATED_PATH = path.join(DATA_DIR, "admin-auth.json.migrated");
const COOKIE_NAME = "influrios_admin_session";
const SESSION_DAYS = 7;

/** Map legacy coarse permissions → granular set (store migration). */
const LEGACY_PERMISSION_MAP: Record<string, AdminPermission[]> = {
  banners: ["banners.view", "banners.edit"],
  cards: ["cards.view", "cards.edit"],
  matching: [
    "matching.view",
    "matching.manage_optins",
    "matching.create_intros",
    "matching.advance_intros",
  ],
  intelligence: ["intelligence.view", "intelligence.export"],
  billing: ["billing.view"],
  payments: ["payments.view", "payments.manage"],
  trust: ["trust.view", "trust.mediate"],
  agency: ["agency.view", "agency.manage"],
  commerce: ["commerce.view", "commerce.manage"],
  access: ["access.manage_roles", "access.manage_users"],
};

const DEFAULT_ROLES: AdminRole[] = [
  {
    id: "role_super",
    name: "Super Admin",
    description: "Full access — every admin feature and access-control tools.",
    permissions: [...ADMIN_PERMISSIONS],
    system: true,
  },
  {
    id: "role_content",
    name: "Content Admin",
    description: "Landing banners and influencer card CMS (view + edit).",
    permissions: [
      "banners.view",
      "banners.edit",
      "cards.view",
      "cards.edit",
      "taxonomy.view",
      "taxonomy.edit",
    ],
    system: true,
  },
  {
    id: "role_ops",
    name: "Ops Admin",
    description: "Matching, intelligence, payments, trust, and agency (no billing/access).",
    permissions: [
      "matching.view",
      "matching.manage_optins",
      "matching.create_intros",
      "matching.advance_intros",
      "intelligence.view",
      "intelligence.export",
      "payments.view",
      "payments.manage",
      "trust.view",
      "trust.mediate",
      "agency.view",
      "agency.manage",
      "commerce.view",
      "commerce.manage",
      "invitations.view",
      "invitations.edit",
      "collaborations.view",
      "collaborations.edit",
      "ai.view",
      "ai.edit",
      "signing.view",
      "signing.edit",
      "social.view",
      "social.edit",
      "legal.view",
      "legal.edit",
      "shortlinks.view",
      "shortlinks.edit",
      "mail.view",
      "mail.edit",
      "jobs.view",
      "jobs.retry",
      "marketplace.view",
      "marketplace.manage",
    ],
    system: true,
  },
  {
    id: "role_billing",
    name: "Billing Admin",
    description: "Billing catalog, checkout sessions, and country payment gateways.",
    permissions: ["billing.view", "gateways.view", "gateways.edit"],
    system: true,
  },
  {
    id: "role_payments",
    name: "Payments Admin",
    description: "Protected payments escrow console only.",
    permissions: [
      "payments.view",
      "payments.manage",
      "gateways.view",
      "gateways.edit",
      "marketplace.view",
      "marketplace.manage",
    ],
    system: true,
  },
  {
    id: "role_trust",
    name: "Trust Admin",
    description: "Dispute mediation and contract briefs only.",
    permissions: ["trust.view", "trust.mediate"],
    system: true,
  },
  {
    id: "role_agency",
    name: "Agency Admin",
    description: "Agency roster, campaigns, and portfolios only.",
    permissions: ["agency.view", "agency.manage"],
    system: true,
  },
  {
    id: "role_readonly",
    name: "Read-only Admin",
    description: "View banners and cards only — no edits.",
    permissions: ["banners.view", "cards.view"],
    system: true,
  },
];

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "influrios-dev-admin-secret-change-me"
  );
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, hash: string) {
  const next = hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function expandPermissions(raw: string[]): AdminPermission[] {
  const set = new Set<AdminPermission>();
  for (const p of raw) {
    if ((ADMIN_PERMISSIONS as readonly string[]).includes(p)) {
      set.add(p as AdminPermission);
      continue;
    }
    const mapped = LEGACY_PERMISSION_MAP[p];
    if (mapped) mapped.forEach((m) => set.add(m));
  }
  return [...set];
}

function normalizeStore(store: AdminAuthStore): AdminAuthStore {
  return {
    ...store,
    roles: store.roles.map((role) => ({
      ...role,
      permissions: expandPermissions(role.permissions as string[]),
    })),
  };
}

function defaultStore(): AdminAuthStore {
  const salt = randomBytes(16).toString("hex");
  const password = process.env.ADMIN_SUPER_PASSWORD || "InfluriosAdmin!2026";
  const email = (process.env.ADMIN_SUPER_EMAIL || "admin@influrios.com").toLowerCase();
  return {
    roles: structuredClone(DEFAULT_ROLES),
    users: [
      {
        id: "user_super",
        email,
        name: "Super Admin",
        roleId: "role_super",
        passwordHash: hashPassword(password, salt),
        passwordSalt: salt,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

function roleFromDb(row: {
  id: string;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
}): AdminRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    system: row.system,
    permissions: expandPermissions(row.permissions),
  };
}

function userFromDb(row: {
  id: string;
  email: string;
  name: string;
  roleId: string;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleId: row.roleId,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadStoreFromDb(): Promise<AdminAuthStore> {
  const [roles, users] = await Promise.all([
    prisma.adminRole.findMany({ orderBy: { name: "asc" } }),
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return normalizeStore({
    roles: roles.map(roleFromDb),
    users: users.map(userFromDb),
  });
}

async function writeStoreToDb(store: AdminAuthStore) {
  const normalized = normalizeStore(store);
  await prisma.$transaction(async (tx) => {
    for (const role of normalized.roles) {
      await tx.adminRole.upsert({
        where: { id: role.id },
        create: {
          id: role.id,
          name: role.name,
          description: role.description,
          system: Boolean(role.system),
          permissions: role.permissions,
        },
        update: {
          name: role.name,
          description: role.description,
          system: Boolean(role.system),
          permissions: role.permissions,
        },
      });
    }
    for (const user of normalized.users) {
      await tx.adminUser.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          passwordHash: user.passwordHash,
          passwordSalt: user.passwordSalt,
          active: user.active,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        },
        update: {
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          passwordHash: user.passwordHash,
          passwordSalt: user.passwordSalt,
          active: user.active,
          updatedAt: new Date(user.updatedAt),
        },
      });
    }
  });
}

async function syncSystemRolesDb() {
  for (const def of DEFAULT_ROLES) {
    await prisma.adminRole.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        name: def.name,
        description: def.description,
        system: true,
        permissions: [...def.permissions],
      },
      update: {
        name: def.name,
        description: def.description,
        system: true,
        permissions: [...def.permissions],
      },
    });
  }
}

async function readLegacyJsonStore(): Promise<AdminAuthStore | null> {
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AdminAuthStore;
    if (!parsed.roles?.length || !parsed.users?.length) return null;
    return normalizeStore(parsed);
  } catch {
    return null;
  }
}

async function markLegacyMigrated() {
  try {
    await fs.rename(LEGACY_STORE_PATH, LEGACY_MIGRATED_PATH);
  } catch {
    try {
      await fs.unlink(LEGACY_STORE_PATH);
    } catch {
      /* ignore */
    }
  }
}

/**
 * DB is authoritative. Empty tables import admin-auth.json once, else bootstrap
 * from ADMIN_SUPER_EMAIL / ADMIN_SUPER_PASSWORD (and DEFAULT_ROLES).
 */
async function ensureStore(): Promise<AdminAuthStore> {
  const userCount = await prisma.adminUser.count();
  if (userCount === 0) {
    const legacy = await readLegacyJsonStore();
    if (legacy) {
      await writeStoreToDb(legacy);
      await markLegacyMigrated();
    } else {
      await writeStoreToDb(defaultStore());
    }
  }
  await syncSystemRolesDb();
  return loadStoreFromDb();
}

async function saveStore(store: AdminAuthStore) {
  await writeStoreToDb(store);
}

export async function getAdminAuthStore() {
  return ensureStore();
}

export function encodeSession(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = signPayload(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(token: string | undefined | null): AdminSession | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = signPayload(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.exp || Date.now() > session.exp) return null;
    session.permissions = expandPermissions(session.permissions as string[]);
    return session;
  } catch {
    return null;
  }
}

export async function loginAdmin(email: string, password: string): Promise<
  | { ok: true; token: string; session: AdminSession }
  | { ok: false; error: string }
> {
  const store = await ensureStore();
  const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.active);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return { ok: false, error: "Invalid email or password" };
  }
  const role = store.roles.find((r) => r.id === user.roleId) ?? DEFAULT_ROLES[0];
  const session: AdminSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleId: role.id,
    roleName: role.name,
    permissions: expandPermissions(role.permissions as string[]),
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  return { ok: true, token: encodeSession(session), session };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE_NAME)?.value);
}

export function hasPermission(
  session: AdminSession | null | undefined,
  permission: AdminPermission,
): boolean {
  return Boolean(session?.permissions.includes(permission));
}

export function canAccessModule(
  session: AdminSession | null | undefined,
  module: AdminModule,
): boolean {
  if (!session) return false;
  const prefix = `${module}.`;
  return session.permissions.some((p) => p.startsWith(prefix));
}

export async function requireAdminSession(
  permission?: AdminPermission,
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError("unauthorized");
  if (permission && !hasPermission(session, permission)) {
    throw new AdminAuthError("forbidden");
  }
  return session;
}

export class AdminAuthError extends Error {
  constructor(public code: "unauthorized" | "forbidden") {
    super(code);
  }
}

export const ADMIN_COOKIE = COOKIE_NAME;

/** Secure only on HTTPS. The public site is served over HTTP, and a Secure cookie is dropped there. */
export function cookieIsSecure(forwardedProto: string | null | undefined) {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}

export async function adminCookieOptions(maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  const headerStore = await headers();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieIsSecure(headerStore.get("x-forwarded-proto")),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function createAdminRole(input: {
  name: string;
  description: string;
  permissions: AdminPermission[];
}) {
  const store = await ensureStore();
  const permissions = expandPermissions(input.permissions);
  if (!permissions.length) throw new Error("Select at least one feature permission");
  const role: AdminRole = {
    id: `role_${randomBytes(4).toString("hex")}`,
    name: input.name.trim(),
    description: input.description.trim(),
    permissions,
  };
  store.roles.push(role);
  await saveStore(store);
  return role;
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  roleId: string;
}) {
  const store = await ensureStore();
  const email = input.email.trim().toLowerCase();
  if (store.users.some((u) => u.email === email)) {
    throw new Error("Email already exists");
  }
  if (!store.roles.some((r) => r.id === input.roleId)) {
    throw new Error("Unknown role");
  }
  const salt = randomBytes(16).toString("hex");
  const user: AdminUser = {
    id: `user_${randomBytes(4).toString("hex")}`,
    email,
    name: input.name.trim(),
    roleId: input.roleId,
    passwordHash: hashPassword(input.password, salt),
    passwordSalt: salt,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.users.push(user);
  await saveStore(store);
  return { id: user.id, email: user.email, name: user.name, roleId: user.roleId };
}

export async function setAdminUserActive(userId: string, active: boolean) {
  const store = await ensureStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  if (user.roleId === "role_super" && !active) {
    const supers = store.users.filter((u) => u.roleId === "role_super" && u.active);
    if (supers.length <= 1) throw new Error("Cannot deactivate the last Super Admin");
  }
  user.active = active;
  user.updatedAt = new Date().toISOString();
  await saveStore(store);
}

export async function updateAdminUserRole(userId: string, roleId: string) {
  const store = await ensureStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  if (!store.roles.some((r) => r.id === roleId)) throw new Error("Unknown role");
  user.roleId = roleId;
  user.updatedAt = new Date().toISOString();
  await saveStore(store);
}

export function permissionLabel(p: AdminPermission | string) {
  for (const group of ADMIN_PERMISSION_GROUPS) {
    const found = group.permissions.find((x) => x.id === p);
    if (found) return found.label;
  }
  return String(p);
}

export function moduleLabel(module: AdminModule) {
  return ADMIN_PERMISSION_GROUPS.find((g) => g.module === module)?.label ?? module;
}
