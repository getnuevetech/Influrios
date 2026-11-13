export const SUPER_ADMIN_ROLE_ID = "role_super";

type AccessUser = { id: string; roleId: string; active: boolean };

/** True when this change would leave no active Super Admin. */
export function lastSuperAdminRemovalBlocked(
  users: readonly AccessUser[],
  userId: string,
  next: { roleId: string; active: boolean },
): boolean {
  const user = users.find((row) => row.id === userId);
  if (!user || !user.active || user.roleId !== SUPER_ADMIN_ROLE_ID) return false;
  if (next.roleId === SUPER_ADMIN_ROLE_ID && next.active) return false;
  return !users.some((row) => row.id !== userId && row.roleId === SUPER_ADMIN_ROLE_ID && row.active);
}

/** Permissions in the request that the acting admin does not already hold. */
export function permissionsOutsideDelegation(
  requested: readonly string[],
  actor: readonly string[],
): string[] {
  const held = new Set(actor);
  const outside: string[] = [];
  for (const permission of requested) {
    if (!held.has(permission) && !outside.includes(permission)) outside.push(permission);
  }
  return outside;
}
