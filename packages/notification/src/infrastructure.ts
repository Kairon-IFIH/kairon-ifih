import type { PrismaClient } from "@prisma/client";
import { asNotificationId, NotificationId, TenantContext, UserId } from "@kairon/shared-kernel";
import { Notification, NotificationType } from "./domain";
import type { NotificationRepository } from "./domain";

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: {
    id: string;
    recipientUserId: string;
    type: string;
    payload: unknown;
    read: boolean;
    createdAt: Date;
  }): Notification {
    return Notification.reconstitute(asNotificationId(row.id), {
      recipientUserId: row.recipientUserId as UserId,
      type: row.type as NotificationType,
      payload: row.payload as Record<string, unknown>,
      read: row.read,
      createdAt: row.createdAt,
    });
  }

  async findForUser(ctx: TenantContext, userId: UserId, unreadOnly: boolean): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { tenantId: ctx.tenantId, recipientUserId: userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(ctx: TenantContext, notificationId: NotificationId): Promise<Notification | null> {
    const row = await this.prisma.notification.findFirst({ where: { id: notificationId, tenantId: ctx.tenantId } });
    return row ? this.toDomain(row) : null;
  }

  async save(ctx: TenantContext, notification: Notification): Promise<void> {
    await this.prisma.notification.upsert({
      where: { id: notification.id },
      create: {
        id: notification.id,
        tenantId: ctx.tenantId,
        recipientUserId: notification.recipientUserId,
        type: notification.type,
        payload: notification.payload as object,
        read: notification.read,
        createdAt: notification.createdAt,
      },
      update: {
        read: notification.read,
      },
    });
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
