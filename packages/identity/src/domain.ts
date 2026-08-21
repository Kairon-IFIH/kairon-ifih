import bcrypt from "bcryptjs";
import {
  AggregateRoot,
  Entity,
  OrganizationId,
  RoleId,
  TenantId,
  UserId,
  ValidationError,
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

  static create(resource: string, action: string): Permission {
    if (!resource.trim() || !action.trim()) {
      throw new ValidationError(["Permission requires a non-empty resource and action"]);
    }
    return new Permission({ resource: resource.trim(), action: action.trim() });
  }

  get resource(): string {
    return this.props.resource;
  }

  get action(): string {
    return this.props.action;
  }

  /** "asset:create" style key, used for fast Set-based lookups. */
  get key(): string {
    return `${this.props.resource}:${this.props.action}`;
  }
}

// ---- Entities ----

export const ROLE_NAMES = ["TenantAdmin", "ComplianceOfficer", "RiskAnalyst", "Auditor"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export interface RoleProps {
  readonly name: RoleName;
  readonly permissions: Permission[];
}

export class Role extends Entity<RoleId> {
  private constructor(id: RoleId, private readonly props: RoleProps) {
    super(id);
  }

  static create(id: RoleId, props: RoleProps): Role {
    if (!ROLE_NAMES.includes(props.name)) {
      throw new ValidationError([`Unknown role name: ${props.name}`]);
    }
    return new Role(id, props);
  }

  get name(): RoleName {
    return this.props.name;
  }

  get permissions(): readonly Permission[] {
    return this.props.permissions;
  }

  hasPermission(permission: Permission): boolean {
    return this.props.permissions.some(
      (p) =>
        p.equals(permission) ||
        (p.resource === "*" && p.action === "*") ||
        (p.resource === permission.resource && p.action === "*")
    );
  }
}

/** Baseline permission sets per role (ARCHITECTURE.md §4.2) — the Auditor role is read-only by construction. */
export function defaultPermissionsForRole(name: RoleName): Permission[] {
  switch (name) {
    case "TenantAdmin":
      return [
        Permission.create("*", "*"),
      ];
    case "ComplianceOfficer":
      return [
        Permission.create("asset", "read"),
        Permission.create("compliance", "read"),
        Permission.create("compliance", "write"),
      ];
    case "RiskAnalyst":
      return [
        Permission.create("asset", "read"),
        Permission.create("asset", "write"),
        Permission.create("risk", "read"),
        Permission.create("risk", "write"),
        Permission.create("financial", "read"),
        Permission.create("optimization", "read"),
        Permission.create("optimization", "write"),
      ];
    case "Auditor":
      return [
        Permission.create("asset", "read"),
        Permission.create("risk", "read"),
        Permission.create("financial", "read"),
        Permission.create("compliance", "read"),
        Permission.create("audit", "read"),
      ];
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

  static create(id: UserId, props: UserProps): User {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new ValidationError([`Invalid email: ${props.email}`]);
    }
    return new User(id, { ...props, email: props.email.toLowerCase() });
  }

  static hashPassword(plaintext: string): string {
    if (plaintext.length < 8) {
      throw new ValidationError(["Password must be at least 8 characters"]);
    }
    return bcrypt.hashSync(plaintext, 10);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get email(): string {
    return this.props.email;
  }

  get roleIds(): readonly RoleId[] {
    return this.props.roleIds;
  }

  verifyPassword(plaintext: string): boolean {
    return bcrypt.compareSync(plaintext, this.props.passwordHash);
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

  static create(id: OrganizationId, props: OrganizationProps): Organization {
    if (!props.name.trim()) {
      throw new ValidationError(["Organization name cannot be empty"]);
    }
    return new Organization(id, props);
  }

  get name(): string {
    return this.props.name;
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

  static create(id: TenantId, props: TenantProps): Tenant {
    if (!props.name.trim()) {
      throw new ValidationError(["Tenant name cannot be empty"]);
    }
    return new Tenant(id, props);
  }

  get name(): string {
    return this.props.name;
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
