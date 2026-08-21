import { Worker } from "bullmq";
import { ALL_QUEUES, type AnyDomainEventEnvelope } from "@kairon/event-contracts";
import { createAuditModule, PrismaAuditEventRepository } from "@kairon/audit";
import { createNotificationModule, PrismaNotificationRepository, type RecipientResolver } from "@kairon/notification";
import { createLogger } from "@kairon/logger";

const log = createLogger("worker");

/**
 * Composition root for the BullMQ side (ARCHITECTURE.md §8). One Worker per
 * queue; the Audit consumer subscribes to every queue (cross-cutting), the
 * Notification consumer only to Notifications. Redis connection details come
 * from env — this file does not decide retry/backoff policy, that is a
 * Phase 2 configuration decision, not an architectural one.
 *
 * Note: apps/api does not currently publish onto these BullMQ queues — it
 * uses InMemoryEventPublisher (see apps/api/src/main.ts). This process is
 * the real Phase-2 consumer once a BullMqEventPublisher replaces that.
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

  // This process has no per-request "who's asking" context (it's a pure
  // background consumer), so it can't yet resolve a real recipient without a
  // hydrated UserRepository lookup by tenant-admin role — that lands with the
  // Phase 2 Prisma wiring alongside PrismaUserRepository. Until then this
  // returns null, and NotifyOnDomainEventUseCaseImpl already treats "no
  // recipient" as a logged no-op, not a crash.
  const recipientResolver: RecipientResolver = { resolve: () => null };
  const notification = createNotificationModule({
    notificationRepository: new PrismaNotificationRepository(prismaClient),
    recipientResolver,
  });

  const workers = ALL_QUEUES.map((queueName) => {
    const worker = new Worker(
      queueName,
      async (job) => {
        const envelope = job.data as AnyDomainEventEnvelope;
        log.info("processing job", { queue: queueName, jobId: job.id, eventName: envelope.eventName });
        await audit.recordAuditEvent.execute(envelope);
        if (queueName === "notifications") {
          await notification.notifyOnDomainEvent.execute(envelope);
        }
      },
      { connection }
    );

    worker.on("failed", (job, err) => {
      log.error("job failed", { queue: queueName, jobId: job?.id, message: err.message });
    });

    return worker;
  });

  return workers;
}

if (require.main === module) {
  createWorkers();
  log.info("KAIRON worker consumers started");
}

export { createWorkers };
