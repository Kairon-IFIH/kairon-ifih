import { asTenantId, asUserId, fail, ok, Result, UnauthorizedError } from "@kairon/shared-kernel";
import type { LoginRequest, RefreshTokenRequest } from "@kairon/api-contracts";
import { createLogger } from "@kairon/logger";
import type { Permission, PermissionCheckerService, RoleRepository, TenantRepository, User, UserRepository } from "./domain";
import { rotateRefreshToken, signAccessToken, signRefreshToken } from "./jwt";

const log = createLogger("auth");

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

async function issueAccessToken(deps: Pick<Dependencies, "roleRepository">, user: User): Promise<string> {
  const roles = await Promise.all(
    user.roleIds.map((roleId) => deps.roleRepository.findById(user.tenantId, roleId))
  );
  const roleNames = roles.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => r.name);

  return signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    organizationId: user.organizationId,
    roles: roleNames,
  });
}

export class LoginUseCaseImpl implements LoginUseCase {
  constructor(private readonly deps: Pick<Dependencies, "userRepository" | "roleRepository">) {}

  async execute(request: LoginRequest): Promise<Result<AuthTokens>> {
    const user = await this.deps.userRepository.findByEmail(request.email);
    if (!user || !user.verifyPassword(request.password)) {
      log.warn("login failed", { email: request.email });
      return fail(new UnauthorizedError());
    }

    const accessToken = await issueAccessToken(this.deps, user);
    const refreshToken = signRefreshToken(user.id, user.tenantId);
    log.info("login succeeded", { userId: user.id, tenantId: user.tenantId });

    return ok({ accessToken, refreshToken });
  }
}

export class RefreshTokenUseCaseImpl implements RefreshTokenUseCase {
  constructor(private readonly deps: Pick<Dependencies, "userRepository" | "roleRepository">) {}

  async execute(request: RefreshTokenRequest): Promise<Result<AuthTokens>> {
    const { claims, nextToken } = rotateRefreshToken(request.refreshToken);

    const user = await this.deps.userRepository.findById(asTenantId(claims.tenantId), asUserId(claims.sub));
    if (!user) {
      log.warn("refresh failed — user no longer exists", { userId: claims.sub });
      return fail(new UnauthorizedError());
    }

    const accessToken = await issueAccessToken(this.deps, user);
    log.info("token refreshed", { userId: user.id, tenantId: user.tenantId });

    return ok({ accessToken, refreshToken: nextToken });
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
