import type { DomainError } from "./errors";

export class Success<T> {
  readonly isSuccess = true as const;
  constructor(readonly value: T) {}
}

export class Failure<E> {
  readonly isSuccess = false as const;
  constructor(readonly error: E) {}
}

export type Result<T, E extends DomainError = DomainError> = Success<T> | Failure<E>;

export const ok = <T>(value: T): Success<T> => new Success(value);
export const fail = <E extends DomainError>(error: E): Failure<E> => new Failure(error);

export function isSuccess<T, E extends DomainError>(result: Result<T, E>): result is Success<T> {
  return result.isSuccess;
}
