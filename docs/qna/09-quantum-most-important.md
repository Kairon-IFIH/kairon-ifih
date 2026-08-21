# 9. Quantum — Most Important

**What exact problem are we solving with quantum?** — We use quantum optimization to choose the best combination of risk-remediation actions for a financial institution.

**Why is this suitable for quantum optimization?** — Because selecting the best combination from many actions under multiple constraints is a combinatorial optimization problem.

**What is the input to the quantum model?** — Each remediation action's cost, risk reduction, financial impact, regulatory priority and constraints.

**Where does this data come from?** — It comes from KAIRON's asset discovery, risk assessment, regulatory mapping and remediation analysis.

**What are our decision variables?** — Each action is a binary variable: 1 = select it, 0 = don't select it.

**What are our constraints?** — Budget, mandatory regulatory controls, dependencies and operational/business limitations.

**What is our objective function?** — Minimize the institution's residual expected financial risk.

**What are we minimizing?** — The financial risk remaining after selecting the remediation actions.

**What are we maximizing?** — Risk reduction for the available budget.

**Why can't a simple rule-based system solve it?** — Rules can rank individual actions, but they struggle to find the best combination when hundreds of actions and constraints interact.

**Why isn't greedy optimization enough?** — Choosing the best action individually may produce a worse overall combination.

**Why isn't MILP enough?** — MILP is a strong classical baseline, but we want to test whether quantum approaches can provide competitive solution quality as the optimization problem scales.

**Why isn't simulated annealing enough?** — It is another useful classical method, but we use it as a benchmark rather than assuming any method is automatically superior.

**Why QAOA?** — QAOA is designed for combinatorial optimization and naturally fits our binary decision problem.

**Why not VQE?** — VQE is primarily aimed at estimating ground-state energies, while our problem is more naturally framed as a combinatorial optimization problem.

**What is the QUBO formulation?** — We convert our remediation objective and constraints into a Quadratic Unconstrained Binary Optimization problem that QAOA can solve.

**What do the binary variables represent?** — Each binary variable represents whether a specific remediation action is selected.

**How do we encode budget constraints?** — We add a penalty when the selected actions exceed the available budget.

**How do we encode mandatory regulatory controls?** — Mandatory controls receive constraints or strong penalties if they are not selected.

**How do we encode dependencies?** — We penalize or prevent combinations where a required prerequisite action is missing.

**How do we encode business disruption?** — We add an operational-disruption cost or constraint to the optimization objective.

**How do we encode financial impact?** — Each action receives an estimated expected-loss reduction based on the risk model.

**How do we encode asset criticality?** — Higher-criticality assets receive greater risk/financial impact weights.

**How do we encode risk reduction?** — Each remediation action receives an estimated reduction in the associated risk exposure.

**What is the size of our optimization problem?** — For the prototype, we should start with a manageable synthetic problem and then demonstrate how the number of combinations grows with scale.

**How many variables?** — Ideally 20–50 binary remediation variables for the prototype, depending on simulator performance.

**How many constraints?** — The exact number depends on the synthetic scenario, but we will include budget, regulatory, dependency and operational constraints.

**How many possible combinations exist?** — With N binary actions, there are 2ᴺ possible combinations, so even 50 actions create an enormous search space.

**How does complexity grow with institution size?** — As the number of possible remediation decisions grows, the number of possible combinations grows exponentially.
