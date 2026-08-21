import { ValueObject } from "./entity-base";
import { CurrencyMismatchError, ValidationError } from "./errors";

export type CurrencyCode = "INR" | "USD";

export interface MoneyProps {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** Money must never be a bare number (ARCHITECTURE.md §3.2) — arithmetic here is currency-safe by construction. */
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: CurrencyCode): Money {
    if (!Number.isFinite(amount)) {
      throw new ValidationError([`Money amount must be a finite number, got ${amount}`]);
    }
    if (amount < 0) {
      throw new ValidationError(["Money amount cannot be negative"]);
    }
    return new Money({ amount: Math.round(amount * 100) / 100, currency });
  }

  static zero(currency: CurrencyCode): Money {
    return new Money({ amount: 0, currency });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): CurrencyCode {
    return this.props.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(this.amount * factor, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
