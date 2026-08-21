import { randomUUID } from "node:crypto";
import {
  asNotificationId,
  asOrganizationId,
  asTenantId,
  fail,
  NotFoundError,
  NotificationId,
  ok,
  Result,
  TenantContext,
  UserId,
} from "@kairon/shared-kernel";
import type { ListNotificationsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";
import { createLogger } from "@kairon/logger";
import { Notification, NotificationConsumer, NotificationRepository, NotificationType } from "./domain";

const log = createLogger("notification");

export interface NotifyOnDomainEventUseCase {
  execute(envelope: AnyDomainEventEnvelope): Promise<Result<void>>;
}

export interface ListNotificationsUseCase {
  execute(ctx: TenantContext, query: ListNotificationsQuery): Promise<Result<PaginatedResult<Notification>>>;
}

export interface MarkNotificationReadUseCase {
  execute(ctx: TenantContext, notificationId: NotificationId): Promise<Result<void>>;
}

/**
 * Resolves who should be notified for a given event. MVP is single-recipient
 * (no per-tenant subscription/preference model yet — that's Phase 6) so this
 * is intentionally a thin seam: `apps/api` wires it to the tenant's seeded
 * admin user today, and a real subscription lookup replaces the function
 * body later without touching NotifyOnDomainEventUseCaseImpl at all.
 */
export interface RecipientResolver {
  resolve(envelope: AnyDomainEventEnvelope): UserId | null;
}

const EVENT_TO_NOTIFICATION_TYPE: Partial<Record<AnyDomainEventEnvelope["eventName"], NotificationType>> = {
  OptimizationExecuted: "OPTIMIZATION_COMPLETE",
  RemediationApproved: "REMEDIATION_PENDING_APPROVAL",
};

export interface Dependencies {
  notificationRepository: NotificationRepository;
  recipientResolver: RecipientResolver;
}

export class NotifyOnDomainEventUseCaseImpl implements NotifyOnDomainEventUseCase, NotificationConsumer {
  constructor(private readonly deps: Dependencies) {}

  async execute(envelope: AnyDomainEventEnvelope): Promise<Result<void>> {
    const type = EVENT_TO_NOTIFICATION_TYPE[envelope.eventName];
    if (!type) {
      // Not every domain event is HITL-notifiable — silently ignore the rest.
      return ok(undefined);
    }

    const recipientUserId = this.deps.recipientResolver.resolve(envelope);
    if (!recipientUserId) {
      log.warn("no recipient resolved for notifiable event", { eventName: envelope.eventName });
      return ok(undefined);
    }

    const notification = Notification.create(asNotificationId(randomUUID()), {
      recipientUserId,
      type,
      payload: envelope.payload as unknown as Record<string, unknown>,
    });

    // NotificationRepository is tenant-scoped via TenantContext everywhere else
    // in this codebase; a background consumer has no inbound request to take
    // one from, so it builds the minimal context its save() call needs directly
    // from the envelope, which always carries tenantId (ARCHITECTURE.md §8).
    const payload = envelope.payload as { tenantId?: string };
    const ctx: TenantContext = {
      tenantId: asTenantId(payload.tenantId ?? "unknown-tenant"),
      organizationId: asOrganizationId("unknown-org"),
      userId: recipientUserId,
      roles: [],
    };

    await this.deps.notificationRepository.save(ctx, notification);
    log.info("notification created", { tenantId: ctx.tenantId, recipientUserId, type });

    return ok(undefined);
  }

  async handle(envelope: AnyDomainEventEnvelope): Promise<void> {
    const result = await this.execute(envelope);
    if (!result.isSuccess) throw result.error;
  }
}

export class ListNotificationsUseCaseImpl implements ListNotificationsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, query: ListNotificationsQuery): Promise<Result<PaginatedResult<Notification>>> {
    const all = await this.deps.notificationRepository.findForUser(ctx, ctx.userId, query.unreadOnly);
    const start = (query.page - 1) * query.pageSize;
    const items = all.slice(start, start + query.pageSize);
    return ok({ items, page: query.page, pageSize: query.pageSize, total: all.length });
  }
}

export class MarkNotificationReadUseCaseImpl implements MarkNotificationReadUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, notificationId: NotificationId): Promise<Result<void>> {
    const notification = await this.deps.notificationRepository.findById(ctx, notificationId);
    if (!notification) {
      return fail(new NotFoundError("Notification", notificationId));
    }
    notification.markRead();
    await this.deps.notificationRepository.save(ctx, notification);
    return ok(undefined);
  }
}

export function createNotificationModule(deps: Dependencies) {
  return {
    notifyOnDomainEvent: new NotifyOnDomainEventUseCaseImpl(deps),
    listNotifications: new ListNotificationsUseCaseImpl(deps),
    markNotificationRead: new MarkNotificationReadUseCaseImpl(deps),
  };
}

export type NotificationModule = ReturnType<typeof createNotificationModule>;
