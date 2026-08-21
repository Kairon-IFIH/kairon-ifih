import { AggregateRoot, NotificationId, TenantContext, UserId, ValidationError } from "@kairon/shared-kernel";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";

/**
 * Bounded Context: Notification (ARCHITECTURE.md §2/§6). Consumer for HITL-style
 * workflows — e.g. "optimization job complete, review required". Natural home
 * for a Hybrid-track Audit/Verification agent story if that track is declared.
 */

export type NotificationType = "OPTIMIZATION_COMPLETE" | "REMEDIATION_PENDING_APPROVAL";
const NOTIFICATION_TYPES: NotificationType[] = ["OPTIMIZATION_COMPLETE", "REMEDIATION_PENDING_APPROVAL"];

export interface NotificationProps {
  readonly recipientUserId: UserId;
  readonly type: NotificationType;
  readonly payload: Record<string, unknown>;
  readonly read: boolean;
  readonly createdAt: Date;
}

export class Notification extends AggregateRoot<NotificationId> {
  private constructor(id: NotificationId, private props: NotificationProps) {
    super(id);
  }

  static create(id: NotificationId, props: Omit<NotificationProps, "read" | "createdAt">): Notification {
    if (!NOTIFICATION_TYPES.includes(props.type)) {
      throw new ValidationError([`Unknown notification type: ${props.type}`]);
    }
    return new Notification(id, { ...props, read: false, createdAt: new Date() });
  }

  get recipientUserId(): UserId {
    return this.props.recipientUserId;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  get payload(): Record<string, unknown> {
    return this.props.payload;
  }

  get read(): boolean {
    return this.props.read;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  markRead(): void {
    this.props = { ...this.props, read: true };
  }
}

export interface NotificationRepository {
  findForUser(ctx: TenantContext, userId: UserId, unreadOnly: boolean): Promise<Notification[]>;
  findById(ctx: TenantContext, notificationId: NotificationId): Promise<Notification | null>;
  save(ctx: TenantContext, notification: Notification): Promise<void>;
}

export interface NotificationConsumer {
  handle(envelope: AnyDomainEventEnvelope): Promise<void>;
}
