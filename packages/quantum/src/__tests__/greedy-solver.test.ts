import { asOptimizationJobId, asTenantId, Money } from "@kairon/shared-kernel";
import { GreedyClassicalSolverGateway } from "../infrastructure";
import { BudgetConstraint, ObjectiveFunction, OptimizationJob } from "../domain";

const tenantId = asTenantId("tenant-1");

describe("GreedyClassicalSolverGateway", () => {
  it("selects the best risk-reduction/cost ratio within budget", async () => {
    const gateway = new GreedyClassicalSolverGateway();

    const job = OptimizationJob.create(asOptimizationJobId("job-1"), tenantId, {
      objective: ObjectiveFunction.default(),
      constraints: [],
      candidateActions: [
        { actionId: "a1", cost: Money.create(1_000_000, "INR"), riskReduction: 0.4 },
        { actionId: "a2", cost: Money.create(500_000, "INR"), riskReduction: 0.25 },
        { actionId: "a3", cost: Money.create(2_000_000, "INR"), riskReduction: 0.3 },
        { actionId: "a4", cost: Money.create(300_000, "INR"), riskReduction: 0.1 },
      ],
      mandatoryActionIds: [],
      budgetConstraint: BudgetConstraint.create(Money.create(1_800_000, "INR")),
    });

    await gateway.submitJob(job);
    const result = await gateway.getResult(job.id);

    expect(result).not.toBeNull();
    // a2 (0.5 ratio) + a1 (0.4 ratio) + a4 (0.33 ratio) = 1,800,000 spent, all fit;
    // a3's ratio (0.15) is worst and its cost alone exceeds the remaining budget.
    expect([...result!.selectedActionIds].sort()).toEqual(["a1", "a2", "a4"]);
    expect(result!.totalCost.amount).toBe(1_800_000);
    expect(result!.riskReductionPercent).toBe(75);
  });

  it("always includes mandatory actions before optimizing the rest", async () => {
    const gateway = new GreedyClassicalSolverGateway();

    const job = OptimizationJob.create(asOptimizationJobId("job-2"), tenantId, {
      objective: ObjectiveFunction.default(),
      constraints: [],
      candidateActions: [
        { actionId: "mandatory", cost: Money.create(900_000, "INR"), riskReduction: 0.05 },
        { actionId: "better-ratio", cost: Money.create(100_000, "INR"), riskReduction: 0.5 },
      ],
      mandatoryActionIds: ["mandatory"],
      budgetConstraint: BudgetConstraint.create(Money.create(950_000, "INR")),
    });

    await gateway.submitJob(job);
    const result = await gateway.getResult(job.id);

    expect(result!.selectedActionIds).toContain("mandatory");
  });

  it("returns null for a job that was never submitted", async () => {
    const gateway = new GreedyClassicalSolverGateway();
    expect(await gateway.getResult(asOptimizationJobId("nonexistent"))).toBeNull();
  });
});
