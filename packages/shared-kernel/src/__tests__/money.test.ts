import { Money } from "../money";
import { CurrencyMismatchError, ValidationError } from "../errors";

describe("Money", () => {
  it("creates a valid amount rounded to 2 decimals", () => {
    const m = Money.create(100.004, "INR");
    expect(m.amount).toBe(100);
    expect(m.currency).toBe("INR");
  });

  it("rejects negative amounts", () => {
    expect(() => Money.create(-1, "INR")).toThrow(ValidationError);
  });

  it("rejects non-finite amounts", () => {
    expect(() => Money.create(Number.NaN, "INR")).toThrow(ValidationError);
  });

  it("adds same-currency amounts", () => {
    const a = Money.create(100, "INR");
    const b = Money.create(50, "INR");
    expect(a.add(b).amount).toBe(150);
  });

  it("rejects cross-currency arithmetic", () => {
    const a = Money.create(100, "INR");
    const b = Money.create(50, "USD");
    expect(() => a.add(b)).toThrow(CurrencyMismatchError);
    expect(() => a.isGreaterThan(b)).toThrow(CurrencyMismatchError);
  });

  it("multiplies by a factor", () => {
    const a = Money.create(100, "INR");
    expect(a.multiply(0.5).amount).toBe(50);
  });

  it("compares amounts of the same currency", () => {
    const a = Money.create(100, "INR");
    const b = Money.create(50, "INR");
    expect(a.isGreaterThan(b)).toBe(true);
    expect(b.isGreaterThan(a)).toBe(false);
  });
});
