import {
  AuditEventId,
  Entity,
  NotImplementedError,
  TenantContext,
  UserId,
  ValueObject,
} from "@kairon/shared-kernel";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";

/**
 * Bounded Context: Audit (ARCHITECTURE.md §3.1). Treated as cross-cutting
 * infrastructure consumed by every other context, not a peer domain.
 * AuditEvent is immutable and append-only — this is why this file, unlike
 * every sibling domain.ts, defines NO AggregateRoot and exposes NO mutator.
 */

// ---- Value Objects ----

export interface ActorRefProps {
  readonly userId: UserId;
  readonly displayName: string;
}

export class ActorRef extends ValueObject<ActorRefProps> {
  private constructor(props: ActorRefProps) {
    super(props);
  }

  static create(_userId: UserId, _displayName: string): ActorRef {
    throw new NotImplementedError("ActorRef.create — Phase 2");
  }
}

export interface BeforeAfterDiffProps {
  readonly before: Record<string, unknown>;
  readonly after: Record<string, unknown>;
}

export class BeforeAfterDiff extends ValueObject<BeforeAfterDiffProps> {
  private constructor(props: BeforeAfterDiffProps) {
    super(props);
  }

  static create(_before: Record<string, unknown>, _after: Record<string, unknown>): BeforeAfterDiff {
    throw new NotImplementedError("BeforeAfterDiff.create — Phase 2");
  }
}

// ---- Entity (not an AggregateRoot: it raises no further domain events) ----

export interface AuditEventProps {
  readonly timestamp: Date;
  readonly actor: ActorRef;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly diff: BeforeAfterDiff;
}

export class AuditEvent extends Entity<AuditEventId> {
  private constructor(id: AuditEventId, private readonly props: AuditEventProps) {
    super(id);
  }

  /** The ONLY way an AuditEvent comes into existence — matches BACKEND.md's required shape exactly. */
  static record(_id: AuditEventId, _props: AuditEventProps): AuditEvent {
    throw new NotImplementedError("AuditEvent.record — Phase 2, BACKEND.md Auditability Requirements");
  }
}

// ---- Repository ----
// Deliberately exposes no update()/delete() — structural, not a convention to remember
// (ARCHITECTURE.md §5.4: DB-level grants additionally revoke UPDATE/DELETE on this table).

export interface AuditEventRepository {
  append(event: AuditEvent): Promise<void>;
  findByEntity(ctx: TenantContext, entityType: string, entityId: string): Promise<AuditEvent[]>;
  findByDateRange(ctx: TenantContext, from: Date, to: Date): Promise<AuditEvent[]>;
}

// ---- Consumer contract ----

/** Every domain event, from every context, is appended to the audit trail (ARCHITECTURE.md §8). */
export interface AuditEventConsumer {
  handle(envelope: AnyDomainEventEnvelope): Promise<void>;
}
