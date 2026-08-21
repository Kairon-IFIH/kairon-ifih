import { asOrganizationId, asRoleId, asTenantId, asUserId, ValidationError } from "@kairon/shared-kernel";
import { defaultPermissionsForRole, Permission, Role, User } from "../domain";

describe("Permission", () => {
  it("rejects empty resource/action", () => {
    expect(() => Permission.create("", "read")).toThrow(ValidationError);
  });
});

describe("Role.hasPermission", () => {
  it("matches an exact permission", () => {
    const role = Role.create(asRoleId("role-1"), {
      name: "RiskAnalyst",
      permissions: defaultPermissionsForRole("RiskAnalyst"),
    });
    expect(role.hasPermission(Permission.create("risk", "write"))).toBe(true);
    expect(role.hasPermission(Permission.create("compliance", "write"))).toBe(false);
  });

  it("TenantAdmin's wildcard matches everything", () => {
    const role = Role.create(asRoleId("role-2"), {
      name: "TenantAdmin",
      permissions: defaultPermissionsForRole("TenantAdmin"),
    });
    expect(role.hasPermission(Permission.create("anything", "delete"))).toBe(true);
  });

  it("Auditor is read-only by construction", () => {
    const role = Role.create(asRoleId("role-3"), {
      name: "Auditor",
      permissions: defaultPermissionsForRole("Auditor"),
    });
    expect(role.hasPermission(Permission.create("asset", "read"))).toBe(true);
    expect(role.hasPermission(Permission.create("asset", "write"))).toBe(false);
  });
});

describe("User", () => {
  const tenantId = asTenantId("tenant-1");
  const organizationId = asOrganizationId("org-1");

  it("hashes and verifies a password", () => {
    const hash = User.hashPassword("changeme123");
    const user = User.create(asUserId("user-1"), {
      tenantId,
      organizationId,
      email: "Admin@Example.com",
      passwordHash: hash,
      roleIds: [],
    });
    expect(user.verifyPassword("changeme123")).toBe(true);
    expect(user.verifyPassword("wrong")).toBe(false);
  });

  it("lowercases email on create", () => {
    const user = User.create(asUserId("user-2"), {
      tenantId,
      organizationId,
      email: "Admin@Example.com",
      passwordHash: User.hashPassword("changeme123"),
      roleIds: [],
    });
    expect(user.email).toBe("admin@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() =>
      User.create(asUserId("user-3"), {
        tenantId,
        organizationId,
        email: "not-an-email",
        passwordHash: User.hashPassword("changeme123"),
        roleIds: [],
      })
    ).toThrow(ValidationError);
  });

  it("rejects a short password at hash time", () => {
    expect(() => User.hashPassword("short")).toThrow(ValidationError);
  });
});
