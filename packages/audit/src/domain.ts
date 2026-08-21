import {
  AuditEventId,
  Entity,
  TenantContext,
  TenantId,
  UserId,
  ValidationError,
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

  static create(userId: UserId, displayName: string): ActorRef {
    return new ActorRef({ userId, displayName });
  }

  static system(): ActorRef {
    return new ActorRef({ userId: "system" as UserId, displayName: "system" });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get displayName(): string {
    return this.props.displayName;
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

  static create(before: Record<string, unknown>, after: Record<string, unknown>): BeforeAfterDiff {
    return new BeforeAfterDiff({ before, after });
  }

  get before(): Record<string, unknown> {
    return this.props.before;
  }

  get after(): Record<string, unknown> {
    return this.props.after;
  }
}

// ---- Entity (not an AggregateRoot: it raises no further domain events) ----

export interface AuditEventProps {
  readonly tenantId: TenantId;
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
  static record(id: AuditEventId, props: AuditEventProps): AuditEvent {
    if (!props.action.trim() || !props.entityType.trim() || !props.entityId.trim()) {
      throw new ValidationError(["AuditEvent requires action, entityType and entityId"]);
    }
    return new AuditEvent(id, props);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get actor(): ActorRef {
    return this.props.actor;
  }

  get action(): string {
    return this.props.action;
  }

  get entityType(): string {
    return this.props.entityType;
  }

  get entityId(): string {
    return this.props.entityId;
  }

  get diff(): BeforeAfterDiff {
    return this.props.diff;
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
