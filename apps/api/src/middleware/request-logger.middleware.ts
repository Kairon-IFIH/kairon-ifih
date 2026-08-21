import type { NextFunction, Request, Response } from "express";
import { createLogger } from "@kairon/logger";
import type { RequestWithClaims } from "./auth.middleware";

const log = createLogger("http");

/** First middleware in the chain — logs every request/response, redacted (BACKEND.md Logging Requirements). */
export function requestLoggerMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    res.on("finish", () => {
      const claims = (req as Partial<RequestWithClaims>).accessTokenClaims;
      log.info("request completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        tenantId: claims?.tenantId,
        userId: claims?.sub,
      });
    });
    next();
  };
}
