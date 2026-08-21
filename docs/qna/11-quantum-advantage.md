# 11. Quantum Advantage

**Where does quantum outperform classical today?** — We are not claiming it does yet; we will measure this through our benchmark.

**If it doesn't, why use quantum?** — Because our problem becomes much harder as the number of remediation choices and constraints grows, making it a strong candidate for future quantum optimization.

**What benchmark are we running?** — We compare QAOA against a classical optimizer on the exact same problem.

**What classical algorithm are we comparing against?** — We can use MILP and/or simulated annealing as our classical baseline.

**Is the comparison fair?** — Yes, both methods get the same data, objective, constraints and problem size.

**Same problem?** — Yes, exactly the same remediation-selection problem.

**Same constraints?** — Yes, budget, regulatory, dependency and operational constraints are identical.

**Same objective?** — Yes, both minimize residual expected financial risk.

**Same hardware/simulator assumptions?** — Yes, we clearly disclose that our quantum prototype runs on a simulator and compare accordingly.

**What metric are we comparing?** — Mainly solution quality, constraint satisfaction and convergence, with runtime reported separately.

**Runtime?** — We report it honestly, but simulator runtime is not evidence of real quantum advantage.

**Solution quality?** — We compare how much residual financial risk each method leaves.

**Convergence?** — We compare how efficiently each method reaches a good solution.

**Scalability?** — We show how the number of possible solutions grows as remediation choices increase.

**What happens when quantum loses?** — We show it honestly and use the stronger classical result; we don't fake quantum advantage.

**What is the realistic timeline for quantum advantage?** — We see it as a future opportunity as hardware becomes more capable, not a Year-1 assumption.

**What hardware assumption are we making?** — Our prototype uses a quantum simulator, while future production use would depend on sufficiently capable hardware.

**Why is this strategically relevant today?** — We can build and validate the optimization problem today while making the platform quantum-ready for future hardware.

## Best one-line answer to memorize

> "We are not selling quantum speedup today; we are proving that our financial-risk optimization problem can run through a quantum-classical architecture and benchmarking it honestly against classical methods."
