/**
 * Admin access control — cookie sessions + file-backed roles/permissions.
 * Super admin (env) can create admin accounts with scoped access levels.
 */
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "crypto";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import path from "path";

export const ADMIN_PERMISSIONS = [
  "banners",
  "cards",
  "matching",
  "intelligence",
  "billing",
  "access",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

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
const STORE_PATH = path.join(DATA_DIR, "admin-auth.json");
const COOKIE_NAME = "influrios_admin_session";
const SESSION_DAYS = 7;

const DEFAULT_ROLES: AdminRole[] = [
  {
    id: "role_super",
    name: "Super Admin",
    description: "Full access — manage admins, content, matching, intelligence, billing.",
    permissions: [...ADMIN_PERMISSIONS],
    system: true,
  },
  {
    id: "role_content",
    name: "Content Admin",
    description: "Landing banners and influencer card CMS only.",
    permissions: ["banners", "cards"],
    system: true,
  },
  {
    id: "role_ops",
    name: "Ops Admin",
    description: "Managed matching and intelligence consoles.",
    permissions: ["matching", "intelligence"],
    system: true,
  },
  {
    id: "role_billing",
    name: "Billing Admin",
    description: "Billing catalog and checkout sessions only.",
    permissions: ["billing"],
    system: true,
  },
  {
    id: "role_readonly",
    name: "Read-only Admin",
    description: "View banners and cards; no matching/billing/access.",
    permissions: ["banners", "cards"],
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

function defaultStore(): AdminAuthStore {
  const salt = randomBytes(16).toString("hex");
  const password =
    process.env.ADMIN_SUPER_PASSWORD || "InfluriosAdmin!2026";
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

async function ensureStore(): Promise<AdminAuthStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AdminAuthStore;
    if (!parsed.roles?.length || !parsed.users?.length) return defaultStore();
    return parsed;
  } catch {
    const store = defaultStore();
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    } catch {
      /* read-only */
    }
    return store;
  }
}

async function saveStore(store: AdminAuthStore) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore */
  }
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
    permissions: role.permissions,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  return { ok: true, token: encodeSession(session), session };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE_NAME)?.value);
}

export async function requireAdminSession(
  permission?: AdminPermission,
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new AdminAuthError("unauthorized");
  }
  if (permission && !session.permissions.includes(permission)) {
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

export function adminCookieOptions(maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
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
  const role: AdminRole = {
    id: `role_${randomBytes(4).toString("hex")}`,
    name: input.name.trim(),
    description: input.description.trim(),
    permissions: input.permissions,
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

export function permissionLabel(p: AdminPermission) {
  const map: Record<AdminPermission, string> = {
    banners: "Banners",
    cards: "Influencer cards",
    matching: "Managed matching",
    intelligence: "Intelligence",
    billing: "Billing",
    access: "Admin access levels",
  };
  return map[p];
}
