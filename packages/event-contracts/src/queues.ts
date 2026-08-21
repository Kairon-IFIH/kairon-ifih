import type { DomainEventName } from "./events";

/**
 * One BullMQ queue per event family (ARCHITECTURE.md §8), so a slow consumer
 * (e.g. Quantum) can't backpressure an unrelated flow (e.g. Audit).
 * The Audit Service additionally subscribes to every queue below — it is a
 * cross-cutting consumer, not the owner of any one of them.
 */
export enum QueueName {
  AssetEvents = "asset-events",
  ComplianceEvents = "compliance-events",
  RiskEvents = "risk-events",
  FinancialEvents = "financial-events",
  OptimizationJobs = "optimization-jobs",
  Notifications = "notifications",
}

export const EVENT_QUEUE_MAP: Record<DomainEventName, QueueName> = {
  AssetDiscovered: QueueName.AssetEvents,
  AssetClassified: QueueName.AssetEvents,
  ComplianceMapped: QueueName.ComplianceEvents,
  RiskCalculated: QueueName.RiskEvents,
  FinancialExposureQuantified: QueueName.FinancialEvents,
  RemediationGenerated: QueueName.OptimizationJobs,
  OptimizationExecuted: QueueName.OptimizationJobs,
  RemediationApproved: QueueName.Notifications,
};

export const ALL_QUEUES: QueueName[] = Object.values(QueueName);
