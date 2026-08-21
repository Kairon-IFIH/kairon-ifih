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
