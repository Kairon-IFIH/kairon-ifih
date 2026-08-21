import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "@kairon/shared-kernel";
import { createLogger } from "@kairon/logger";

const log = createLogger("auth");

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
  familyId: string;
  jti: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshTokenRaw(claims: RefreshTokenClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

function verifyRefreshTokenRaw(token: string): RefreshTokenClaims {
  try {
    return jwt.verify(token, JWT_SECRET) as RefreshTokenClaims;
  } catch {
    throw new UnauthorizedError();
  }
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenClaims;
  } catch {
    throw new UnauthorizedError();
  }
}

/**
 * Refresh-token rotation with reuse detection (ARCHITECTURE.md §9 flagged
 * this as required hardening, not optional). Every refresh token belongs to
 * a "family" created at login; each rotation issues a new jti in the same
 * family and marks the old one spent. If a spent jti is ever presented again
 * — the signature of a stolen-and-replayed token — the entire family is
 * revoked, forcing re-login instead of quietly accepting the replay.
 *
 * In-memory for the MVP (Phase-"right now" persistence, same convention as
 * every InMemoryX*Repository); a real deployment moves this to Redis so it
 * survives process restarts and works across multiple API instances.
 */
class RefreshTokenStore {
  private readonly spentJtis = new Set<string>();
  private readonly revokedFamilies = new Set<string>();

  markSpentOrThrow(claims: RefreshTokenClaims): void {
    if (this.revokedFamilies.has(claims.familyId)) {
      throw new UnauthorizedError();
    }
    if (this.spentJtis.has(claims.jti)) {
      this.revokedFamilies.add(claims.familyId);
      log.warn("refresh token reuse detected — revoking token family", {
        familyId: claims.familyId,
        sub: claims.sub,
      });
      throw new UnauthorizedError();
    }
    this.spentJtis.add(claims.jti);
  }
}

const refreshTokenStore = new RefreshTokenStore();

/** Issues a fresh token family — call this at login only. */
export function signRefreshToken(sub: string, tenantId: string): string {
  return signRefreshTokenRaw({ sub, tenantId, familyId: randomUUID(), jti: randomUUID() });
}

/** Verifies, checks reuse, spends the old jti, and issues the next token in the same family. */
export function rotateRefreshToken(token: string): { claims: RefreshTokenClaims; nextToken: string } {
  const claims = verifyRefreshTokenRaw(token);
  refreshTokenStore.markSpentOrThrow(claims);
  // Only re-sign the fields we own — `claims` also carries jwt's own `exp`/`iat`
  // from verification, which conflicts with passing `expiresIn` again.
  const nextToken = signRefreshTokenRaw({
    sub: claims.sub,
    tenantId: claims.tenantId,
    familyId: claims.familyId,
    jti: randomUUID(),
  });
  return { claims, nextToken };
}
