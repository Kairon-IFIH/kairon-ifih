import { NotificationId, NotImplementedError, TenantContext, UserId } from "@kairon/shared-kernel";
import type { Notification, NotificationRepository } from "./domain";

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: unknown) {}

  async findForUser(_ctx: TenantContext, _userId: UserId, _unreadOnly: boolean): Promise<Notification[]> {
    throw new NotImplementedError("PrismaNotificationRepository.findForUser — Phase 5");
  }

  async findById(_ctx: TenantContext, _notificationId: NotificationId): Promise<Notification | null> {
    throw new NotImplementedError("PrismaNotificationRepository.findById — Phase 5");
  }

  async save(_ctx: TenantContext, _notification: Notification): Promise<void> {
    throw new NotImplementedError("PrismaNotificationRepository.save — Phase 5");
  }
}

/** In-memory implementation — the actual Phase-"right now" persistence, tenant-nested. */
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly byTenant = new Map<string, Map<string, Notification>>();

  private tenantStore(ctx: TenantContext): Map<string, Notification> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async findForUser(ctx: TenantContext, userId: UserId, unreadOnly: boolean): Promise<Notification[]> {
    const all = [...this.tenantStore(ctx).values()].filter((n) => n.recipientUserId === userId);
    return unreadOnly ? all.filter((n) => !n.read) : all;
  }

  async findById(ctx: TenantContext, notificationId: NotificationId): Promise<Notification | null> {
    return this.tenantStore(ctx).get(notificationId) ?? null;
  }

  async save(ctx: TenantContext, notification: Notification): Promise<void> {
    this.tenantStore(ctx).set(notification.id, notification);
  }
}
