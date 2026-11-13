import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { lastSuperAdminRemovalBlocked, permissionsOutsideDelegation } from "./access-delegation";

const users = [
  { id: "super", roleId: "role_super", active: true },
  { id: "content", roleId: "role_content", active: true },
];

describe("last super admin", () => {
  it("rejects deactivating or reassigning the only active super admin", () => {
    assert.equal(
      lastSuperAdminRemovalBlocked(users, "super", { roleId: "role_super", active: false }),
      true,
    );
    assert.equal(
      lastSuperAdminRemovalBlocked(users, "super", { roleId: "role_content", active: true }),
      true,
    );
    assert.equal(
      lastSuperAdminRemovalBlocked(users, "content", { roleId: "role_content", active: false }),
      false,
    );
    assert.equal(
      lastSuperAdminRemovalBlocked(users, "super", { roleId: "role_super", active: true }),
      false,
    );
  });

  it("allows the change when another active super admin remains", () => {
    const two = [...users, { id: "other", roleId: "role_super", active: true }];
    assert.equal(lastSuperAdminRemovalBlocked(two, "super", { roleId: "role_content", active: true }), false);
    const inactiveOther = [
      users[0]!,
      { id: "other", roleId: "role_super", active: false },
    ];
    assert.equal(
      lastSuperAdminRemovalBlocked(inactiveOther, "super", { roleId: "role_content", active: true }),
      true,
    );
  });
});

describe("permission delegation", () => {
  it("rejects a grant the actor does not hold", () => {
    assert.deepEqual(
      permissionsOutsideDelegation(["access.manage_roles", "payments.edit"], ["access.manage_roles"]),
      ["payments.edit"],
    );
    assert.deepEqual(permissionsOutsideDelegation(["access.manage_roles"], ["access.manage_roles", "payments.edit"]), []);
  });

  it("is enforced on role writes and admin assignment", () => {
    const auth = readFileSync("src/lib/admin-auth.ts", "utf8");
    const actions = readFileSync("src/app/admin/actions-auth.ts", "utf8");
    assert.match(auth, /lastSuperAdminRemovalBlocked/);
    assert.match(auth, /permissionsOutsideDelegation/);
    assert.match(auth, /You cannot grant a permission you do not hold/);
    assert.match(actions, /actorPermissions: session\.permissions/);
  });
});
