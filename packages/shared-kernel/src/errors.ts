export abstract class DomainError extends Error {
  abstract readonly code: string;
}

/**
 * Marks a method whose behavior is designed (see ARCHITECTURE.md) but not yet
 * implemented. Every occurrence names the phase/section that implements it —
 * this is what turns the scaffold into docs/IMPLEMENTATION_ROADMAP.md's checklist.
 */
export class NotImplementedError extends DomainError {
  readonly code = "NOT_IMPLEMENTED";
  constructor(where: string) {
    super(`Not implemented: ${where}`);
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";
  constructor(public readonly issues: string[]) {
    super("Validation failed");
  }
}

export class TenantMismatchError extends DomainError {
  readonly code = "TENANT_MISMATCH";
  constructor() {
    super("Resource does not belong to the requesting tenant");
  }
}

export class CurrencyMismatchError extends DomainError {
  readonly code = "CURRENCY_MISMATCH";
  constructor(a: string, b: string) {
    super(`Cannot operate on mismatched currencies: ${a} vs ${b}`);
  }
}

export class InsufficientBudgetError extends DomainError {
  readonly code = "INSUFFICIENT_BUDGET";
  constructor() {
    super("Selected remediation actions exceed the available budget");
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED";
  constructor() {
    super("Authentication required");
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN";
  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
  }
}
