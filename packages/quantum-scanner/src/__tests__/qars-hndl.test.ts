import { CRQC_ARRIVAL_YEAR, HndlAssessment, QarsScore } from "../domain";

describe("HndlAssessment.calculate (Mosca's Theorem)", () => {
  it("flags ACT NOW when shelf life + migration time exceeds years until CRQC", () => {
    // TRANSACTION: 7yr shelf life + 1yr migration = 8. In 2026, years-to-CRQC = 4. 8 > 4 -> ACT NOW.
    const assessment = HndlAssessment.calculate("TRANSACTION", 2026);
    expect(assessment.actNow).toBe(true);
    expect(assessment.status).toBe("ACT NOW (Harvest Now Decrypt Later risk)");
  });

  it("is safe when shelf life + migration time is within the CRQC horizon", () => {
    // STATIC: 0yr shelf life + 1yr migration = 1. In 2026, years-to-CRQC = 4. 1 <= 4 -> safe.
    const assessment = HndlAssessment.calculate("STATIC", 2026);
    expect(assessment.actNow).toBe(false);
    expect(assessment.status).toBe(`Safe until ${CRQC_ARRIVAL_YEAR - 1}`);
  });

  it("AUTHENTICATION tier sits on the boundary at the reference current year", () => {
    // AUTHENTICATION: 1yr shelf life + 1yr migration = 2. years-to-CRQC in 2026 = 4. 2 <= 4 -> safe.
    const assessment = HndlAssessment.calculate("AUTHENTICATION", 2026);
    expect(assessment.actNow).toBe(false);
  });

  it("even STATIC (0yr shelf life) flips to ACT NOW once CRQC arrival is within the 1yr migration lead time", () => {
    // dangerPoint = 0 + 1 = 1; yearsToCrqc = CRQC_ARRIVAL_YEAR - currentYear. At
    // currentYear = CRQC_ARRIVAL_YEAR, yearsToCrqc = 0, and 1 > 0 -> ACT NOW.
    const assessment = HndlAssessment.calculate("STATIC", CRQC_ARRIVAL_YEAR);
    expect(assessment.actNow).toBe(true);
  });

  it("reconstitute rebuilds a persisted assessment without recomputing against a live clock", () => {
    const original = HndlAssessment.calculate("TRANSACTION", 2026);
    const restored = HndlAssessment.reconstitute({
      tier: original.tier,
      actNow: original.actNow,
      safeUntilYear: undefined,
    });
    expect(restored.actNow).toBe(original.actNow);
    expect(restored.status).toBe(original.status);
  });
});

describe("QarsScore.calculate", () => {
  it("scores a fully quantum-safe, no-weak-findings asset at 100", () => {
    const qars = QarsScore.calculate({
      totalCryptoAssets: 5,
      quantumVulnerableAssets: 0,
      weakOrBrokenAssets: 0,
      hndlActNow: false,
    });
    expect(qars.score).toBe(100);
    expect(qars.riskLevel).toBe("LOW");
  });

  it("applies the 40/10/10 weighted penalty exactly as the reference rubric defines", () => {
    // All 5 findings vulnerable (ratio 1.0 -> -40), 1 of 5 weak (ratio 0.2 -> -2),
    // HNDL act-now with vulnerable assets present (-10). 100 - 40 - 2 - 10 = 48.
    const qars = QarsScore.calculate({
      totalCryptoAssets: 5,
      quantumVulnerableAssets: 5,
      weakOrBrokenAssets: 1,
      hndlActNow: true,
    });
    expect(qars.score).toBe(48);
    expect(qars.riskLevel).toBe("HIGH");
    expect(qars.rubric.penalties.vulnerableAssets).toBe(40);
    expect(qars.rubric.penalties.weakAssets).toBe(2);
    expect(qars.rubric.penalties.hndlActNow).toBe(10);
  });

  it("never applies the HNDL penalty when there are no vulnerable assets, even if act-now", () => {
    const qars = QarsScore.calculate({
      totalCryptoAssets: 3,
      quantumVulnerableAssets: 0,
      weakOrBrokenAssets: 0,
      hndlActNow: true,
    });
    expect(qars.rubric.penalties.hndlActNow).toBe(0);
    expect(qars.score).toBe(100);
  });

  it("clamps the score to [0, 100]", () => {
    const qars = QarsScore.calculate({
      totalCryptoAssets: 10,
      quantumVulnerableAssets: 10,
      weakOrBrokenAssets: 10,
      hndlActNow: true,
    });
    expect(qars.score).toBeGreaterThanOrEqual(0);
    expect(qars.score).toBeLessThanOrEqual(100);
  });

  it("returns 100 when there are no crypto assets at all (safe ratio division)", () => {
    const qars = QarsScore.calculate({
      totalCryptoAssets: 0,
      quantumVulnerableAssets: 0,
      weakOrBrokenAssets: 0,
      hndlActNow: false,
    });
    expect(qars.score).toBe(100);
    expect(qars.riskLevel).toBe("LOW");
  });

  it("assigns risk levels by the documented score thresholds", () => {
    expect(
      QarsScore.calculate({ totalCryptoAssets: 100, quantumVulnerableAssets: 0, weakOrBrokenAssets: 0, hndlActNow: false })
        .riskLevel
    ).toBe("LOW"); // 100
    expect(
      QarsScore.calculate({ totalCryptoAssets: 100, quantumVulnerableAssets: 50, weakOrBrokenAssets: 0, hndlActNow: false })
        .riskLevel
    ).toBe("MEDIUM"); // 100 - 20 = 80
    expect(
      QarsScore.calculate({ totalCryptoAssets: 100, quantumVulnerableAssets: 100, weakOrBrokenAssets: 0, hndlActNow: false })
        .riskLevel
    ).toBe("HIGH"); // 100 - 40 = 60
    expect(
      QarsScore.calculate({ totalCryptoAssets: 100, quantumVulnerableAssets: 100, weakOrBrokenAssets: 100, hndlActNow: true })
        .riskLevel
    ).toBe("CRITICAL"); // 100 - 40 - 10 - 10 = 40
  });
});
