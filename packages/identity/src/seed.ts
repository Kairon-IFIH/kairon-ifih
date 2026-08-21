import { asOrganizationId, asRoleId, asTenantId, asUserId } from "@kairon/shared-kernel";
import { defaultPermissionsForRole, Organization, ROLE_NAMES, Role, Tenant, User } from "./domain";
import type { RoleRepository, TenantRepository, UserRepository } from "./domain";

/**
 * Seeds one demo tenant/org/role-set/user so the app is logged-into-able the
 * moment it boots, without a separate registration flow (out of MVP scope —
 * ARCHITECTURE.md §1.13 only asks for login, not self-service signup).
 */
export interface SeedResult {
  tenantId: string;
  organizationId: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
}

export async function seedDemoTenant(deps: {
  tenantRepository: TenantRepository;
  userRepository: UserRepository;
  roleRepository: RoleRepository;
}): Promise<SeedResult> {
  const tenantId = asTenantId("demo-tenant");
  const organizationId = asOrganizationId("demo-org");
  const organization = Organization.create(organizationId, { tenantId, name: "GIFT City Demo Bank IBU" });
  const tenant = Tenant.create(tenantId, { name: "Demo Bank", organizations: [organization] });
  await deps.tenantRepository.save(tenant);

  const roleIds: Record<(typeof ROLE_NAMES)[number], ReturnType<typeof asRoleId>> = {
    TenantAdmin: asRoleId("role-tenant-admin"),
    ComplianceOfficer: asRoleId("role-compliance-officer"),
    RiskAnalyst: asRoleId("role-risk-analyst"),
    Auditor: asRoleId("role-auditor"),
  };

  for (const name of ROLE_NAMES) {
    const role = Role.create(roleIds[name], { name, permissions: defaultPermissionsForRole(name) });
    await deps.roleRepository.save(role);
  }

  const adminEmail = "admin@demo-bank.example";
  const adminPassword = "changeme123";
  const adminUserId = asUserId("user-demo-admin");
  const admin = User.create(adminUserId, {
    tenantId,
    organizationId,
    email: adminEmail,
    passwordHash: User.hashPassword(adminPassword),
    roleIds: [roleIds.TenantAdmin],
  });
  await deps.userRepository.save(admin);

  return { tenantId, organizationId, adminUserId, adminEmail, adminPassword };
}
