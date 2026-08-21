import type { AnyDomainEventEnvelope, DomainEventName } from "./events";

/**
 * Every bounded context's application layer depends on this, not on BullMQ
 * directly — matches ARCHITECTURE.md §2's point that the queue is what lets a
 * service later become its own deployable without changing callers.
 */
export interface EventPublisher {
  publish(envelope: AnyDomainEventEnvelope): Promise<void>;
}

type Handler = (envelope: AnyDomainEventEnvelope) => Promise<void>;

/**
 * The actual Phase-"right now" implementation: dispatches in-process instead
 * of through Redis. `apps/worker` + a real `BullMqEventPublisher` (Phase 2)
 * are a drop-in swap for this — same interface, same subscribe-per-queue
 * shape, just crossing a process boundary instead of a function call.
 */
export class InMemoryEventPublisher implements EventPublisher {
  private readonly handlers = new Map<DomainEventName | "*", Handler[]>();

  subscribe(eventName: DomainEventName | "*", handler: Handler): void {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(handler);
    this.handlers.set(eventName, existing);
  }

  async publish(envelope: AnyDomainEventEnvelope): Promise<void> {
    const specific = this.handlers.get(envelope.eventName) ?? [];
    const wildcard = this.handlers.get("*") ?? [];
    for (const handler of [...specific, ...wildcard]) {
      await handler(envelope);
    }
  }
}
