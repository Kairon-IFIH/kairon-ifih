import type { PrismaClient } from "@prisma/client";
import { asOrganizationId, asRoleId, asTenantId, asUserId, NotImplementedError, TenantId, UserId, RoleId } from "@kairon/shared-kernel";
import { Organization, Permission, Role, RoleName, Tenant, User } from "./domain";
import type { RoleRepository, TenantRepository, UserRepository } from "./domain";

/**
 * Prisma-backed implementations (Phase 2). Reconstruction goes through the same
 * `create()` factories the write path uses — safe here because nothing on the
 * read path drains `pullDomainEvents()`, so no phantom events are ever published.
 */
export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: TenantId): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { organizations: true },
    });
    if (!row) return null;
    return Tenant.create(asTenantId(row.id), {
      name: row.name,
      organizations: row.organizations.map((o) =>
        Organization.create(asOrganizationId(o.id), { tenantId: asTenantId(o.tenantId), name: o.name })
      ),
    });
  }

  async save(tenant: Tenant): Promise<void> {
    await this.prisma.tenant.upsert({
      where: { id: tenant.id },
      create: { id: tenant.id, name: tenant.name },
      update: { name: tenant.name },
    });
  }
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: {
    id: string;
    tenantId: string;
    organizationId: string;
    email: string;
    passwordHash: string;
    roles: { roleId: string }[];
  }): User {
    return User.create(asUserId(row.id), {
      tenantId: asTenantId(row.tenantId),
      organizationId: asOrganizationId(row.organizationId),
      email: row.email,
      passwordHash: row.passwordHash,
      roleIds: row.roles.map((r) => asRoleId(r.roleId)),
    });
  }

  async findById(tenantId: TenantId, userId: UserId): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { roles: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          tenantId: user.tenantId,
          organizationId: user.organizationId,
          email: user.email,
          passwordHash: user.passwordHash,
        },
        update: {
          email: user.email,
        },
      }),
      this.prisma.userRole.deleteMany({ where: { userId: user.id } }),
      this.prisma.userRole.createMany({
        data: user.roleIds.map((roleId) => ({ userId: user.id, roleId })),
        skipDuplicates: true,
      }),
    ]);
  }
}

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: { id: string; name: string; permissions: unknown }): Role {
    const permissions = (row.permissions as { resource: string; action: string }[]).map((p) =>
      Permission.create(p.resource, p.action)
    );
    return Role.create(asRoleId(row.id), { name: row.name as RoleName, permissions });
  }

  async findById(tenantId: TenantId, roleId: RoleId): Promise<Role | null> {
    const row = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * The domain `RoleRepository.save(role)` interface carries no tenantId — Role
   * (packages/identity/src/domain.ts) is deliberately not tenant-scoped as an
   * aggregate, even though the Prisma table is. In the running API this method
   * has exactly one caller, `seedDemoTenant` (./seed.ts), and prisma/seed.ts
   * (root) writes roles directly via PrismaClient instead of through this
   * repository — so no live code path reaches this. Left as a clear stub
   * rather than silently guessing a tenantId.
   */
  async save(_role: Role): Promise<void> {
    throw new NotImplementedError(
      "PrismaRoleRepository.save — roles are seeded directly via PrismaClient in prisma/seed.ts, not through this repository"
    );
  }
}

/**
 * Prisma impl (Phase-"right now" persistence) — the actual store once
 * DATABASE_URL is set (apps/api/src/main.ts). In-memory implementations
 * below remain the fallback for local `npm run dev` without a database.
 */
export class InMemoryTenantRepository implements TenantRepository {
  private readonly store = new Map<string, Tenant>();

  async findById(tenantId: TenantId): Promise<Tenant | null> {
    return this.store.get(tenantId) ?? null;
  }

  async save(tenant: Tenant): Promise<void> {
    this.store.set(tenant.id, tenant);
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, User>();

  async findById(tenantId: TenantId, userId: UserId): Promise<User | null> {
    const user = this.byId.get(userId);
    return user && user.tenantId === tenantId ? user : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }

  async save(user: User): Promise<void> {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
  }
}

export class InMemoryRoleRepository implements RoleRepository {
  private readonly store = new Map<string, Role>();

  async findById(_tenantId: TenantId, roleId: RoleId): Promise<Role | null> {
    return this.store.get(roleId) ?? null;
  }

  async save(role: Role): Promise<void> {
    this.store.set(role.id, role);
  }
}
