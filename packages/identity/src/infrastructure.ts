import { NotImplementedError, TenantId, UserId, RoleId } from "@kairon/shared-kernel";
import type { Role, RoleRepository, Tenant, TenantRepository, User, UserRepository } from "./domain";

/**
 * Prisma-backed implementations. No PrismaClient calls yet — wired for Phase 2.
 * Constructor takes `unknown` for the Prisma client so this compiles standalone
 * before `prisma generate` has run against the real schema.
 */
export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: unknown) {}

  async findById(_tenantId: TenantId): Promise<Tenant | null> {
    throw new NotImplementedError("PrismaTenantRepository.findById — Phase 2");
  }

  async save(_tenant: Tenant): Promise<void> {
    throw new NotImplementedError("PrismaTenantRepository.save — Phase 2");
  }
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: unknown) {}

  async findById(_tenantId: TenantId, _userId: UserId): Promise<User | null> {
    throw new NotImplementedError("PrismaUserRepository.findById — Phase 2");
  }

  async findByEmail(_email: string): Promise<User | null> {
    throw new NotImplementedError("PrismaUserRepository.findByEmail — Phase 2");
  }

  async save(_user: User): Promise<void> {
    throw new NotImplementedError("PrismaUserRepository.save — Phase 2");
  }
}

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: unknown) {}

  async findById(_tenantId: TenantId, _roleId: RoleId): Promise<Role | null> {
    throw new NotImplementedError("PrismaRoleRepository.findById — Phase 2");
  }

  async save(_role: Role): Promise<void> {
    throw new NotImplementedError("PrismaRoleRepository.save — Phase 2");
  }
}

/**
 * In-memory implementations — the actual Phase-"right now" persistence, so the
 * app is demoable today without a live Postgres instance. Swap for the Prisma
 * classes above (same interfaces) once RDS is provisioned; nothing above this
 * layer needs to change.
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
