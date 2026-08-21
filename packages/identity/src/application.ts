import { NotImplementedError, Result } from "@kairon/shared-kernel";
import type { LoginRequest, RefreshTokenRequest } from "@kairon/api-contracts";
import type { RoleRepository, TenantRepository, UserRepository } from "./domain";

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

export class LoginUseCaseImpl implements LoginUseCase {
  constructor(private readonly deps: Pick<Dependencies, "userRepository">) {}

  async execute(_request: LoginRequest): Promise<Result<AuthTokens>> {
    throw new NotImplementedError("LoginUseCase.execute — Phase 2, ARCHITECTURE.md §7 Auth strategy");
  }
}

export class RefreshTokenUseCaseImpl implements RefreshTokenUseCase {
  async execute(_request: RefreshTokenRequest): Promise<Result<AuthTokens>> {
    throw new NotImplementedError(
      "RefreshTokenUseCase.execute — Phase 2, refresh-token rotation, ARCHITECTURE.md §9"
    );
  }
}

/** Composition point (dependency injection wiring, no framework needed to see it). */
export function createIdentityModule(deps: Dependencies) {
  return {
    login: new LoginUseCaseImpl(deps),
    refreshToken: new RefreshTokenUseCaseImpl(),
  };
}

export type IdentityModule = ReturnType<typeof createIdentityModule>;
