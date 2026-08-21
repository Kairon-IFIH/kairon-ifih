import type { TenantId } from "./identifiers";

export abstract class Entity<Id> {
  protected constructor(public readonly id: Id) {}

  equals(other?: Entity<Id>): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this.id === other.id;
  }
}

export abstract class ValueObject<Props extends object> {
  protected constructor(protected readonly props: Readonly<Props>) {}

  equals(other?: ValueObject<Props>): boolean {
    if (!other) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

/**
 * Base for all domain events (Section 3.3 / Section 8 of ARCHITECTURE.md).
 * Concrete events live in @kairon/event-contracts as plain payload interfaces;
 * this class is what aggregate roots raise internally before they're mapped
 * to a queue payload at the infrastructure boundary.
 */
export abstract class DomainEvent {
  readonly occurredAt: Date = new Date();
  protected constructor(readonly tenantId: TenantId) {}
  abstract get eventName(): string;
}

export abstract class AggregateRoot<Id> extends Entity<Id> {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }
}
