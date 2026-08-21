import { asTenantId, asUserId, fail, ok, Result, UnauthorizedError } from "@kairon/shared-kernel";
import type { LoginRequest, RefreshTokenRequest } from "@kairon/api-contracts";
import type { Permission, PermissionCheckerService, RoleRepository, TenantRepository, User, UserRepository } from "./domain";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginUseCase {
  execute(request: LoginRequest): Promise<Result<AuthTokens>>;
}

export interface RefreshTokenUseCase {
  execute(request: RefreshTokenRequest): Promise<Result<AuthTokens>>;
}

export interface Dependencies {
  tenantRepository: TenantRepository;
  userRepository: UserRepository;
  roleRepository: RoleRepository;
}

async function issueTokensForUser(
  deps: Pick<Dependencies, "roleRepository">,
  user: User
): Promise<AuthTokens> {
  const roles = await Promise.all(
    user.roleIds.map((roleId) => deps.roleRepository.findById(user.tenantId, roleId))
  );
  const roleNames = roles.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => r.name);

  return {
    accessToken: signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      organizationId: user.organizationId,
      roles: roleNames,
    }),
    refreshToken: signRefreshToken({ sub: user.id, tenantId: user.tenantId }),
  };
}

export class LoginUseCaseImpl implements LoginUseCase {
  constructor(private readonly deps: Pick<Dependencies, "userRepository" | "roleRepository">) {}

  async execute(request: LoginRequest): Promise<Result<AuthTokens>> {
    const user = await this.deps.userRepository.findByEmail(request.email);
    if (!user || !user.verifyPassword(request.password)) {
      return fail(new UnauthorizedError());
    }
    const tokens = await issueTokensForUser(this.deps, user);
    return ok(tokens);
  }
}

export class RefreshTokenUseCaseImpl implements RefreshTokenUseCase {
  constructor(private readonly deps: Pick<Dependencies, "userRepository" | "roleRepository">) {}

  async execute(request: RefreshTokenRequest): Promise<Result<AuthTokens>> {
    // NOTE: no persistent revocation/reuse-detection list yet (ARCHITECTURE.md §9
    // flags this as a required hardening step before production — Phase 2/6).
    const claims = verifyRefreshToken(request.refreshToken);
    const user = await this.deps.userRepository.findById(asTenantId(claims.tenantId), asUserId(claims.sub));
    if (!user) {
      return fail(new UnauthorizedError());
    }
    const tokens = await issueTokensForUser(this.deps, user);
    return ok(tokens);
  }
}

/** Re-checked at the use-case boundary too, per ARCHITECTURE.md §9 — never only at the HTTP layer. */
export class PermissionCheckerServiceImpl implements PermissionCheckerService {
  constructor(private readonly deps: Pick<Dependencies, "roleRepository">) {}

  async hasPermission(user: User, permission: Permission): Promise<boolean> {
    const roles = await Promise.all(
      user.roleIds.map((roleId) => this.deps.roleRepository.findById(user.tenantId, roleId))
    );
    return roles.some((role) => role?.hasPermission(permission) ?? false);
  }
}

/** Composition point (dependency injection wiring, no framework needed to see it). */
export function createIdentityModule(deps: Dependencies) {
  return {
    login: new LoginUseCaseImpl(deps),
    refreshToken: new RefreshTokenUseCaseImpl(deps),
    permissionChecker: new PermissionCheckerServiceImpl(deps),
  };
}

export type IdentityModule = ReturnType<typeof createIdentityModule>;
