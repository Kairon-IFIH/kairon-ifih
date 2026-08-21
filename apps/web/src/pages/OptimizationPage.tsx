import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Trash2, Plus } from "lucide-react";
import { Panel, EmptyState } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { OptimizationFrontier, type FrontierNode } from "../components/viz/OptimizationFrontier";
import { createOptimizationJob, getOptimizationJob } from "../lib/endpoints";
import { formatCompactINR } from "../lib/format";
import type { OptimizationJob } from "../types/api";
import "./optimization-page.css";

/**
 * crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) —
 * this deployment is plain HTTP on an IP, so it's undefined there and throws
 * on call. These ids are just React keys for draft portfolio rows (never
 * validated as UUIDs anywhere they're sent), so Math.random() is sufficient.
 */
function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface DraftAction {
  actionId: string;
  label: string;
  cost: number;
  riskReductionPercent: number;
  mandatory: boolean;
}

/** A starting portfolio so the screen has something to reason about on arrival. */
const STARTER: Omit<DraftAction, "actionId">[] = [
  { label: "Rotate payment signing keys", cost: 1800000, riskReductionPercent: 34, mandatory: false },
  { label: "MFA on privileged access", cost: 650000, riskReductionPercent: 22, mandatory: false },
  { label: "Tokenise card data at rest", cost: 2400000, riskReductionPercent: 28, mandatory: false },
  { label: "Patch SWIFT gateway stack", cost: 380000, riskReductionPercent: 12, mandatory: false },
  { label: "Segment branch VPN", cost: 1200000, riskReductionPercent: 19, mandatory: false },
];

export function OptimizationPage() {
  const [actions, setActions] = useState<DraftAction[]>(() =>
    STARTER.map((a) => ({ ...a, actionId: randomId() }))
  );
  const [label, setLabel] = useState("");
  const [cost, setCost] = useState(500000);
  const [riskReductionPercent, setRiskReductionPercent] = useState(20);
  const [budget, setBudget] = useState(3000000);
  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  function addAction(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setActions((prev) => [
      ...prev,
      { actionId: randomId(), label: label.trim(), cost, riskReductionPercent, mandatory: false },
    ]);
    setLabel("");
  }

  const selectedIds = useMemo(
    () => new Set(job?.result?.selectedActionIds ?? []),
    [job]
  );

  /**
   * The frontier walks candidates in descending efficiency — the same order
   * the server's greedy solver uses — so the drawn path matches the search
   * the optimizer actually performed.
   */
  const frontier = useMemo<FrontierNode[]>(() => {
    const ordered = [...actions].sort(
      (a, b) => b.riskReductionPercent / b.cost - a.riskReductionPercent / a.cost
    );
    let cumCost = 0;
    let cumReduction = 0;
    return ordered.map((a) => {
      cumCost += a.cost;
      cumReduction = Math.min(100, cumReduction + a.riskReductionPercent);
      return {
        actionId: a.actionId,
        label: a.label,
        cost: a.cost,
        reduction: a.riskReductionPercent,
        cumulativeCost: cumCost,
        cumulativeReduction: cumReduction,
        selected: selectedIds.has(a.actionId),
        affordable: cumCost <= budget,
      };
    });
  }, [actions, selectedIds, budget]);

  const portfolioCost = actions.reduce((s, a) => s + a.cost, 0);
  const result = job?.status === "COMPLETED" ? job.result : null;

  async function runOptimization() {
    if (actions.length === 0) return;
    setRunning(true);
    setError(null);
    setJob(null);
    try {
      const { jobId } = await createOptimizationJob({
        candidateActions: actions.map((a) => ({
          actionId: a.actionId,
          cost: a.cost,
          riskReduction: a.riskReductionPercent / 100,
        })),
        budget,
        currency: "INR",
        mandatoryActionIds: actions.filter((a) => a.mandatory).map((a) => a.actionId),
      });

      const poll = async () => {
        const res = await getOptimizationJob(jobId);
        setJob(res);
        if (res.status === "COMPLETED" || res.status === "FAILED") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setRunning(false);
        }
      };
      await poll();
      pollRef.current = window.setInterval(poll, 900);
    } catch {
      setError("Optimization job failed to start.");
      setRunning(false);
    }
  }

  return (
    <div className="optim">
      <ExecutiveStrip>
        <Readout
          lead
          label="Risk reduction bought"
          value={result ? `${Math.round(result.riskReductionPercent)}%` : "—"}
          direction={
            result
              ? { tone: "down", text: `for ${formatCompactINR(result.totalCostAmount)} committed` }
              : { tone: "flat", text: "run the optimizer to resolve a portfolio" }
          }
          parts={[
            { label: "Candidates", value: String(actions.length) },
            { label: "Selected", value: result ? String(result.selectedActionIds.length) : "—" },
          ]}
        />
        <Readout
          label="Capital committed"
          value={result ? formatCompactINR(result.totalCostAmount) : formatCompactINR(0)}
          unit={`of ${formatCompactINR(budget)}`}
          direction={
            result
              ? {
                  tone: "flat",
                  text: `${formatCompactINR(budget - result.totalCostAmount)} left unspent`,
                }
              : undefined
          }
          parts={[{ label: "Full portfolio would cost", value: formatCompactINR(portfolioCost) }]}
        />
        <Readout
          label="Residual after action"
          value={result ? formatCompactINR(result.residualRiskAmount) : "—"}
          direction={
            result
              ? { tone: "up", text: "what the budget could not reach" }
              : undefined
          }
        />
        <Readout
          label="Solver"
          variant="text"
          value={job ? job.status : "IDLE"}
          direction={{ tone: "flat", text: "classical greedy — QAOA not yet wired" }}
          parts={
            result
              ? [
                  { label: "Classical runtime", value: `${result.classicalBaselineComparison.classicalRuntimeMs} ms` },
                  { label: "Quality delta", value: String(result.classicalBaselineComparison.qualityDelta) },
                ]
              : undefined
          }
        />
      </ExecutiveStrip>

      <Panel
        eyebrow="Decision surface"
        title="Optimization frontier"
        caption="Candidates ordered by risk reduction per rupee — the same order the solver walks. Where the curve flattens, each additional rupee buys less than the one before it. The shaded band is beyond budget."
        bleed
      >
        {actions.length === 0 ? (
          <EmptyState>Add at least one remediation action to draw the frontier.</EmptyState>
        ) : (
          <OptimizationFrontier nodes={frontier} budget={budget} currency="INR" />
        )}
      </Panel>

      <div className="optim__split">
        <Panel eyebrow="Portfolio" title="Candidate actions" bleed>
          {actions.length === 0 ? (
            <EmptyState>Nothing in the portfolio yet.</EmptyState>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th className="num">Cost</th>
                  <th className="num">Reduction</th>
                  <th className="num">Per ₹1L</th>
                  <th>Mandatory</th>
                  <th>Outcome</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.actionId} data-selected={selectedIds.has(a.actionId) ? "true" : undefined}>
                    <td>{a.label}</td>
                    <td className="num">{formatCompactINR(a.cost)}</td>
                    <td className="num">{a.riskReductionPercent}%</td>
                    <td className="num">{(a.riskReductionPercent / (a.cost / 100000)).toFixed(2)}%</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={a.mandatory}
                        onChange={() =>
                          setActions((prev) =>
                            prev.map((x) => (x.actionId === a.actionId ? { ...x, mandatory: !x.mandatory } : x))
                          )
                        }
                        aria-label={`Mark ${a.label} mandatory`}
                      />
                    </td>
                    <td>
                      {!result ? (
                        <span className="optim__pending">—</span>
                      ) : selectedIds.has(a.actionId) ? (
                        <span className="optim__chosen">selected</span>
                      ) : (
                        <span className="optim__dropped">not funded</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setActions((prev) => prev.filter((x) => x.actionId !== a.actionId))}
                        aria-label={`Remove ${a.label}`}
                        className="optim__remove"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel eyebrow="Constraints" title="Run the optimizer">
          <form className="optim__add" onSubmit={addAction}>
            <label className="form-field">
              <span className="eyebrow">Add action</span>
              <input
                className="form-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Rotate encryption keys"
              />
            </label>
            <div className="optim__add-row">
              <label className="form-field">
                <span className="eyebrow">Cost ₹</span>
                <input
                  className="form-input num"
                  type="number"
                  min={0}
                  step={50000}
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                />
              </label>
              <label className="form-field">
                <span className="eyebrow">Reduction {riskReductionPercent}%</span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={riskReductionPercent}
                  onChange={(e) => setRiskReductionPercent(Number(e.target.value))}
                />
              </label>
            </div>
            <button type="submit" className="form-button form-button--ghost optim__add-btn">
              <Plus size={14} strokeWidth={1.75} /> Add to portfolio
            </button>
          </form>

          <div className="optim__budget">
            <div className="optim__budget-head">
              <span className="eyebrow">Budget cap</span>
              <span className="optim__budget-value num">{formatCompactINR(budget)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(5000000, portfolioCost)}
              step={50000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
            <p className="optim__budget-note">
              {budget >= portfolioCost
                ? "Budget covers the entire portfolio — the optimizer has nothing to trade off."
                : `${formatCompactINR(portfolioCost - budget)} of candidate spend cannot be funded this cycle.`}
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="button"
            className="form-button optim__run"
            onClick={runOptimization}
            disabled={running || actions.length === 0}
          >
            {running ? "Solving…" : "Resolve optimal portfolio"}
          </button>

          <p className="optim__disclosure">
            Currently solved by a classical greedy knapsack over risk-reduction-per-rupee. The QAOA path is designed
            and stubbed but not wired — this screen does not claim quantum advantage it cannot demonstrate.
          </p>
        </Panel>
      </div>
    </div>
  );
}
