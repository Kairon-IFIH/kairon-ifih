import jwt from "jsonwebtoken";
import { UnauthorizedError } from "@kairon/shared-kernel";

/**
 * Shared between LoginUseCase/RefreshTokenUseCase (issuing) and apps/api's
 * auth middleware (verifying) — one implementation of the JWT contract,
 * not duplicated across the process boundary (ARCHITECTURE.md §7).
 */
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
if (JWT_SECRET === "dev-only-insecure-secret-change-me" && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  organizationId: string;
  roles: string[];
}

export interface RefreshTokenClaims {
  sub: string;
  tenantId: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(claims: RefreshTokenClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenClaims;
  } catch {
    throw new UnauthorizedError();
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    return jwt.verify(token, JWT_SECRET) as RefreshTokenClaims;
  } catch {
    throw new UnauthorizedError();
  }
}
