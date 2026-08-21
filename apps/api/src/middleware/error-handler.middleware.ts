import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import {
  DomainError,
  ForbiddenError,
  NotFoundError,
  TenantMismatchError,
  UnauthorizedError,
  ValidationError,
} from "@kairon/shared-kernel";
import { apiError } from "@kairon/api-contracts";

/**
 * Single centralized error handler (BACKEND.md API Standards: never res.send("error")).
 * Maps typed domain errors to the {success:false, message, errors} contract.
 * Must be the LAST middleware registered.
 */
export function errorHandlerMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ZodError) {
      res.status(400).json(apiError("Validation failed", err.issues.map((i) => i.message)));
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json(apiError(err.message, err.issues));
      return;
    }
    if (err instanceof UnauthorizedError) {
      res.status(401).json(apiError(err.message));
      return;
    }
    if (err instanceof ForbiddenError) {
      res.status(403).json(apiError(err.message));
      return;
    }
    if (err instanceof TenantMismatchError) {
      // 404, not 403 — never confirm cross-tenant existence to the requester.
      res.status(404).json(apiError("Resource not found"));
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json(apiError(err.message));
      return;
    }
    if (err instanceof DomainError) {
      res.status(422).json(apiError(err.message));
      return;
    }
    // Never expose internal error details (BACKEND.md Security Requirements).
    res.status(500).json(apiError("Internal server error"));
  };
}
