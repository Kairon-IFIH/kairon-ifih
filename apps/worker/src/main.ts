import { Worker } from "bullmq";
import { ALL_QUEUES, type AnyDomainEventEnvelope } from "@kairon/event-contracts";
import { createAuditModule, PrismaAuditEventRepository } from "@kairon/audit";
import { createNotificationModule, PrismaNotificationRepository } from "@kairon/notification";

/**
 * Composition root for the BullMQ side (ARCHITECTURE.md §8). One Worker per
 * queue; the Audit consumer subscribes to every queue (cross-cutting), the
 * Notification consumer only to Notifications. Redis connection details come
 * from env — this file does not decide retry/backoff policy, that is a
 * Phase 2 configuration decision, not an architectural one.
 */
function createWorkers() {
  const prismaClient: unknown = undefined;
  const connection = {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };

  const audit = createAuditModule({
    auditEventRepository: new PrismaAuditEventRepository(prismaClient),
  });

  const notification = createNotificationModule({
    notificationRepository: new PrismaNotificationRepository(prismaClient),
  });

  const workers = ALL_QUEUES.map(
    (queueName) =>
      new Worker(
        queueName,
        async (job) => {
          const envelope = job.data as AnyDomainEventEnvelope;
          await audit.recordAuditEvent.execute(envelope);
          if (queueName === "notifications") {
            await notification.notifyOnDomainEvent.execute(envelope);
          }
        },
        { connection }
      )
  );

  return workers;
}

if (require.main === module) {
  createWorkers();
  // eslint-disable-next-line no-console
  console.log("KAIRON worker consumers started");
}

export { createWorkers };
