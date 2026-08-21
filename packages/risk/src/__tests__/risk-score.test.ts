import { Money, ValidationError } from "@kairon/shared-kernel";
import { Impact, Likelihood, RiskScore } from "../domain";

describe("Likelihood", () => {
  it("accepts values within [0,1]", () => {
    expect(Likelihood.create(0).value).toBe(0);
    expect(Likelihood.create(1).value).toBe(1);
    expect(Likelihood.create(0.5).value).toBe(0.5);
  });

  it("rejects values outside [0,1]", () => {
    expect(() => Likelihood.create(-0.1)).toThrow(ValidationError);
    expect(() => Likelihood.create(1.1)).toThrow(ValidationError);
  });
});

describe("RiskScore.calculate", () => {
  it("computes inherent and residual scores from likelihood x impact", () => {
    const likelihood = Likelihood.create(1);
    const impact = Impact.create(100_00_000, "INR"); // == the ₹1 Crore reference ceiling
    const score = RiskScore.calculate(likelihood, impact, 0.3);

    expect(score.inherentScore).toBe(100); // full likelihood x full normalized impact
    expect(score.residualScore).toBe(70); // 30% control-effectiveness discount
    expect(score.level).toBe("HIGH");
  });

  it("caps normalized impact at 100 even above the reference ceiling", () => {
    const likelihood = Likelihood.create(1);
    const impact = Impact.create(500_00_000, "INR"); // 5x the reference ceiling
    const score = RiskScore.calculate(likelihood, impact, 0);
    expect(score.inherentScore).toBe(100);
  });

  it("rejects control effectiveness outside [0,1]", () => {
    const likelihood = Likelihood.create(0.5);
    const impact = Impact.create(10_00_000, "INR");
    expect(() => RiskScore.calculate(likelihood, impact, 1.5)).toThrow(ValidationError);
  });

  it("assigns risk levels by residual score threshold", () => {
    const impact = Impact.create(100_00_000, "INR");
    expect(RiskScore.calculate(Likelihood.create(0.1), impact, 0).level).toBe("LOW");
    expect(RiskScore.calculate(Likelihood.create(0.3), impact, 0).level).toBe("MEDIUM");
    expect(RiskScore.calculate(Likelihood.create(0.6), impact, 0).level).toBe("HIGH");
    expect(RiskScore.calculate(Likelihood.create(1), impact, 0).level).toBe("CRITICAL");
  });
});

describe("Impact", () => {
  it("wraps a Money value", () => {
    const impact = Impact.create(50, "USD");
    expect(impact.money).toBeInstanceOf(Money);
    expect(impact.money.amount).toBe(50);
  });
});
