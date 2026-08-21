import { NotImplementedError, NotificationId, Result, TenantContext } from "@kairon/shared-kernel";
import type { ListNotificationsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";
import type { Notification, NotificationConsumer, NotificationRepository } from "./domain";

export interface NotifyOnDomainEventUseCase {
  execute(envelope: AnyDomainEventEnvelope): Promise<Result<void>>;
}

export interface ListNotificationsUseCase {
  execute(ctx: TenantContext, query: ListNotificationsQuery): Promise<Result<PaginatedResult<Notification>>>;
}

export interface MarkNotificationReadUseCase {
  execute(ctx: TenantContext, notificationId: NotificationId): Promise<Result<void>>;
}

export interface Dependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyOnDomainEventUseCaseImpl implements NotifyOnDomainEventUseCase, NotificationConsumer {
  constructor(private readonly deps: Dependencies) {}

  async execute(_envelope: AnyDomainEventEnvelope): Promise<Result<void>> {
    throw new NotImplementedError(
      "NotifyOnDomainEventUseCase.execute — Phase 5, triggered by OptimizationExecuted / RemediationApproved"
    );
  }

  async handle(envelope: AnyDomainEventEnvelope): Promise<void> {
    const result = await this.execute(envelope);
    if (!result.isSuccess) throw result.error;
  }
}

export class ListNotificationsUseCaseImpl implements ListNotificationsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _query: ListNotificationsQuery
  ): Promise<Result<PaginatedResult<Notification>>> {
    throw new NotImplementedError("ListNotificationsUseCase.execute — Phase 5");
  }
}

export class MarkNotificationReadUseCaseImpl implements MarkNotificationReadUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _notificationId: NotificationId): Promise<Result<void>> {
    throw new NotImplementedError("MarkNotificationReadUseCase.execute — Phase 5");
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
