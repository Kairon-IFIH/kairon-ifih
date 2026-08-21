import { ValueObject } from "./entity-base";
import { NotImplementedError } from "./errors";

export type CurrencyCode = "INR" | "USD";

export interface MoneyProps {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/**
 * Money must never be a bare number (ARCHITECTURE.md §3.2) — currency-safe arithmetic
 * is business logic and is deliberately deferred; only the shape exists so far.
 */
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(_amount: number, _currency: CurrencyCode): Money {
    throw new NotImplementedError("Money.create — Phase 2/3, ARCHITECTURE.md §3.2");
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): CurrencyCode {
    return this.props.currency;
  }

  add(_other: Money): Money {
    throw new NotImplementedError("Money.add");
  }

  multiply(_factor: number): Money {
    throw new NotImplementedError("Money.multiply");
  }

  isGreaterThan(_other: Money): boolean {
    throw new NotImplementedError("Money.isGreaterThan");
  }
}
