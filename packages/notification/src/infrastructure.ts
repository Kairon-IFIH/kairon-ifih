import { NotImplementedError, TenantContext, UserId } from "@kairon/shared-kernel";
import type { Notification, NotificationRepository } from "./domain";

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: unknown) {}

  async findForUser(_ctx: TenantContext, _userId: UserId, _unreadOnly: boolean): Promise<Notification[]> {
    throw new NotImplementedError("PrismaNotificationRepository.findForUser — Phase 5");
  }

  async save(_ctx: TenantContext, _notification: Notification): Promise<void> {
    throw new NotImplementedError("PrismaNotificationRepository.save — Phase 5");
  }
}
