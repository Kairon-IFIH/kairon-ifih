import { useEffect, useRef, useState, type FormEvent } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { Trash2 } from "lucide-react";
import { createOptimizationJob, getOptimizationJob } from "../lib/endpoints";
import { formatCompactINR } from "../lib/format";
import type { OptimizationJob } from "../types/api";
import "./optimization-page.css";

interface DraftAction {
  actionId: string;
  label: string;
  cost: number;
  riskReductionPercent: number;
  mandatory: boolean;
}

export function OptimizationPage() {
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [label, setLabel] = useState("");
  const [cost, setCost] = useState(500000);
  const [riskReductionPercent, setRiskReductionPercent] = useState(20);
  const [budget, setBudget] = useState(1500000);
  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function addAction(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setActions((prev) => [
      ...prev,
      { actionId: crypto.randomUUID(), label: label.trim(), cost, riskReductionPercent, mandatory: false },
    ]);
    setLabel("");
  }

  function removeAction(actionId: string) {
    setActions((prev) => prev.filter((a) => a.actionId !== actionId));
  }

  function toggleMandatory(actionId: string) {
    setActions((prev) => prev.map((a) => (a.actionId === actionId ? { ...a, mandatory: !a.mandatory } : a)));
  }

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
        const result = await getOptimizationJob(jobId);
        setJob(result);
        if (result.status === "COMPLETED" || result.status === "FAILED") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setRunning(false);
        }
      };
      await poll();
      pollRef.current = window.setInterval(poll, 1000);
    } catch {
      setError("Optimization job failed to start.");
      setRunning(false);
    }
  }

  const selectedIds = new Set(job?.result?.selectedActionIds ?? []);
  const chartData = actions.map((a) => ({
    label: a.label,
    cost: a.cost,
    riskReduction: a.riskReductionPercent,
    selected: selectedIds.has(a.actionId),
  }));
  const maxCost = Math.max(1, ...chartData.map((d) => d.cost));

  return (
    <div className="optimization-page">
      <section className="optimization-page__builder">
        <h2 className="risks-page__panel-title">Portfolio</h2>
        <form className="optimization-page__add-form" onSubmit={addAction}>
          <div className="optimization-page__add-form-row">
            <label className="form-field">
              <span className="eyebrow">Remediation action</span>
              <input className="form-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Rotate encryption keys" />
            </label>
            <label className="form-field">
              <span className="eyebrow">Cost (₹)</span>
              <input
                className="form-input num"
                type="number"
                min={0}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="form-field">
            <span className="eyebrow">Expected risk reduction — {riskReductionPercent}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={riskReductionPercent}
              onChange={(e) => setRiskReductionPercent(Number(e.target.value))}
            />
          </label>
          <button type="submit" className="form-button form-button--ghost">
            Add to portfolio
          </button>
        </form>

        {actions.length === 0 ? (
          <p className="asset-detail__hint">No actions yet — add at least one remediation action above.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Cost</th>
                <th>Risk reduction</th>
                <th>Mandatory</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.actionId} className={selectedIds.has(a.actionId) ? "optimization-page__row--selected" : undefined}>
                  <td>{a.label}</td>
                  <td className="num">{formatCompactINR(a.cost)}</td>
                  <td className="num">{a.riskReductionPercent}%</td>
                  <td>
                    <input type="checkbox" checked={a.mandatory} onChange={() => toggleMandatory(a.actionId)} aria-label="Mandatory" />
                  </td>
                  <td>
                    <button type="button" onClick={() => removeAction(a.actionId)} aria-label="Remove" className="optimization-page__remove">
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <label className="form-field optimization-page__budget">
          <span className="eyebrow">Budget cap — {formatCompactINR(budget)}</span>
          <input type="range" min={0} max={5000000} step={50000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button type="button" className="form-button" onClick={runOptimization} disabled={running || actions.length === 0}>
          {running ? "Optimizing…" : "Optimize portfolio"}
        </button>
      </section>

      <section className="optimization-page__result">
        <h2 className="risks-page__panel-title">Result</h2>
        {!job ? (
          <p className="asset-detail__hint">Run the optimizer to see the selected portfolio here.</p>
        ) : job.status !== "COMPLETED" ? (
          <p className="asset-detail__hint num">Status: {job.status}…</p>
        ) : job.result ? (
          <>
            <div className="optimization-page__stats">
              <div>
                <span className="eyebrow">Risk reduction</span>
                <span className="optimization-page__stat-value num">{job.result.riskReductionPercent.toFixed(0)}%</span>
              </div>
              <div>
                <span className="eyebrow">Total cost</span>
                <span className="optimization-page__stat-value num">{formatCompactINR(job.result.totalCostAmount)}</span>
              </div>
              <div>
                <span className="eyebrow">Residual risk</span>
                <span className="optimization-page__stat-value num">{formatCompactINR(job.result.residualRiskAmount)}</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="var(--border-hairline)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-ui)" }} axisLine={{ stroke: "var(--border-hairline)" }} tickLine={false} />
                <YAxis domain={[0, maxCost]} tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={48} />
                <Bar dataKey="cost" radius={[2, 2, 0, 0]} maxBarSize={56}>
                  {chartData.map((d) => (
                    <Cell key={d.label} fill={d.selected ? "var(--accent-safe)" : "var(--accent-data)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="optimization-page__hint">Green bars were selected by the solver; cost is shown per action, in ₹.</p>
          </>
        ) : null}

        <p className="optimization-page__disclosure">
          Currently using classical greedy optimization. Quantum QAOA solver in development.
        </p>
      </section>
    </div>
  );
}
