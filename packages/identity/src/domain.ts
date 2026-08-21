import {
  AggregateRoot,
  Entity,
  NotImplementedError,
  OrganizationId,
  RoleId,
  TenantId,
  UserId,
  ValueObject,
} from "@kairon/shared-kernel";

/**
 * Bounded Context: Identity & Access (ARCHITECTURE.md §3.1).
 * Aggregate root: Tenant. Reused by every other context for authN/authZ.
 */

// ---- Value Objects ----

export interface PermissionProps {
  readonly resource: string;
  readonly action: string;
}

export class Permission extends ValueObject<PermissionProps> {
  private constructor(props: PermissionProps) {
    super(props);
  }

  static create(_resource: string, _action: string): Permission {
    throw new NotImplementedError("Permission.create — Phase 2, ARCHITECTURE.md §4.2");
  }

  get resource(): string {
    return this.props.resource;
  }

  get action(): string {
    return this.props.action;
  }
}

// ---- Entities ----

export interface RoleProps {
  readonly name: "TenantAdmin" | "ComplianceOfficer" | "RiskAnalyst" | "Auditor";
  readonly permissions: Permission[];
}

export class Role extends Entity<RoleId> {
  private constructor(id: RoleId, private readonly props: RoleProps) {
    super(id);
  }

  static create(_id: RoleId, _props: RoleProps): Role {
    throw new NotImplementedError("Role.create — Phase 2, ARCHITECTURE.md §4.2");
  }

  hasPermission(_permission: Permission): boolean {
    throw new NotImplementedError("Role.hasPermission — Phase 2, ARCHITECTURE.md §4.2");
  }
}

export interface UserProps {
  readonly tenantId: TenantId;
  readonly organizationId: OrganizationId;
  readonly email: string;
  readonly passwordHash: string;
  readonly roleIds: RoleId[];
}

export class User extends Entity<UserId> {
  private constructor(id: UserId, private readonly props: UserProps) {
    super(id);
  }

  static create(_id: UserId, _props: UserProps): User {
    throw new NotImplementedError("User.create — Phase 2, ARCHITECTURE.md §4.2");
  }

  verifyPassword(_plaintext: string): boolean {
    throw new NotImplementedError("User.verifyPassword — Phase 2 (bcrypt), BACKEND.md Security Requirements");
  }
}

export interface OrganizationProps {
  readonly tenantId: TenantId;
  readonly name: string;
}

export class Organization extends Entity<OrganizationId> {
  private constructor(id: OrganizationId, private readonly props: OrganizationProps) {
    super(id);
  }

  static create(_id: OrganizationId, _props: OrganizationProps): Organization {
    throw new NotImplementedError("Organization.create — Phase 2");
  }
}

// ---- Aggregate Root ----

export interface TenantProps {
  readonly name: string;
  readonly organizations: Organization[];
}

export class Tenant extends AggregateRoot<TenantId> {
  private constructor(id: TenantId, private readonly props: TenantProps) {
    super(id);
  }

  static create(_id: TenantId, _props: TenantProps): Tenant {
    throw new NotImplementedError("Tenant.create — Phase 2, ARCHITECTURE.md §4");
  }
}

// ---- Repositories (Domain layer interfaces; Prisma impl lives in infrastructure.ts) ----

export interface TenantRepository {
  findById(tenantId: TenantId): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
}

export interface UserRepository {
  findById(tenantId: TenantId, userId: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export interface RoleRepository {
  findById(tenantId: TenantId, roleId: RoleId): Promise<Role | null>;
  save(role: Role): Promise<void>;
}

// ---- Domain Services ----

export interface PermissionCheckerService {
  hasPermission(user: User, permission: Permission): Promise<boolean>;
}
