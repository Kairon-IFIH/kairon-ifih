import { AggregateRoot, NotImplementedError, NotificationId, TenantContext, UserId } from "@kairon/shared-kernel";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";

/**
 * Bounded Context: Notification (ARCHITECTURE.md §2/§6). Consumer for HITL-style
 * workflows — e.g. "optimization job complete, review required". Natural home
 * for a Hybrid-track Audit/Verification agent story if that track is declared.
 */

export type NotificationType = "OPTIMIZATION_COMPLETE" | "REMEDIATION_PENDING_APPROVAL";

export interface NotificationProps {
  readonly recipientUserId: UserId;
  readonly type: NotificationType;
  readonly payload: Record<string, unknown>;
  readonly read: boolean;
  readonly createdAt: Date;
}

export class Notification extends AggregateRoot<NotificationId> {
  private constructor(id: NotificationId, private readonly props: NotificationProps) {
    super(id);
  }

  static create(_id: NotificationId, _props: NotificationProps): Notification {
    throw new NotImplementedError("Notification.create — Phase 5");
  }

  markRead(): void {
    throw new NotImplementedError("Notification.markRead — Phase 5");
  }
}

export interface NotificationRepository {
  findForUser(ctx: TenantContext, userId: UserId, unreadOnly: boolean): Promise<Notification[]>;
  save(ctx: TenantContext, notification: Notification): Promise<void>;
}

export interface NotificationConsumer {
  handle(envelope: AnyDomainEventEnvelope): Promise<void>;
}
