import { UnauthorizedError } from "@kairon/shared-kernel";
import { rotateRefreshToken, signAccessToken, signRefreshToken, verifyAccessToken } from "../jwt";

describe("access tokens", () => {
  it("round-trips claims through sign/verify", () => {
    const token = signAccessToken({
      sub: "user-1",
      tenantId: "tenant-1",
      organizationId: "org-1",
      roles: ["TenantAdmin"],
    });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.roles).toEqual(["TenantAdmin"]);
  });

  it("rejects a garbage token", () => {
    expect(() => verifyAccessToken("not-a-real-token")).toThrow(UnauthorizedError);
  });
});

describe("refresh token rotation", () => {
  it("rotates successfully on first use", () => {
    const refreshToken = signRefreshToken("user-1", "tenant-1");
    const { nextToken, claims } = rotateRefreshToken(refreshToken);
    expect(claims.sub).toBe("user-1");
    expect(nextToken).not.toBe(refreshToken);
  });

  it("detects reuse and revokes the whole family", () => {
    const refreshToken = signRefreshToken("user-2", "tenant-1");
    const { nextToken } = rotateRefreshToken(refreshToken);

    // Replaying the already-spent original token must fail...
    expect(() => rotateRefreshToken(refreshToken)).toThrow(UnauthorizedError);
    // ...and revokes the family, so even the legitimately-rotated token now fails too.
    expect(() => rotateRefreshToken(nextToken)).toThrow(UnauthorizedError);
  });

  it("rejects a spent jti even without an intervening successful rotation", () => {
    const refreshToken = signRefreshToken("user-3", "tenant-1");
    rotateRefreshToken(refreshToken);
    expect(() => rotateRefreshToken(refreshToken)).toThrow(UnauthorizedError);
  });
});
