import express from "express";
import helmet from "helmet";
import cors from "cors";

import { InMemoryEventPublisher } from "@kairon/event-contracts";
import {
  createIdentityModule,
  createIdentityRouter,
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRoleRepository,
  seedDemoTenant,
} from "@kairon/identity";
import { createAssetModule, createAssetRouter, InMemoryAssetRepository } from "@kairon/asset";
import {
  createComplianceModule,
  createComplianceRouter,
  PrismaFrameworkRepository,
  PrismaComplianceMappingRepository,
} from "@kairon/compliance";
import { createRiskModule, createRiskRouter, InMemoryRiskRepository, RiskScoringServiceImpl } from "@kairon/risk";
import {
  createFinancialModule,
  createFinancialRouter,
  InMemoryFinancialExposureRepository,
  QRiskAggregationServiceImpl,
} from "@kairon/financial";
import {
  createQuantumModule,
  createQuantumRouter,
  InMemoryOptimizationJobRepository,
  GreedyClassicalSolverGateway,
} from "@kairon/quantum";
import { createAuditModule, createAuditRouter, InMemoryAuditEventRepository } from "@kairon/audit";
import { createNotificationModule, createNotificationRouter, PrismaNotificationRepository } from "@kairon/notification";

import { createLogger } from "@kairon/logger";

import { requireAuth } from "./middleware/auth.middleware";
import { tenantContextMiddleware } from "./middleware/tenant-context.middleware";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";

const log = createLogger("bootstrap");

/**
 * Composition root: this is the only file in the whole system allowed to know
 * about every bounded context at once. Everything above (domain/application
 * layers) stays ignorant of Express, Prisma, and each other.
 *
 * Persistence is in-memory for the 6 MVP-critical contexts (identity, asset,
 * risk, financial, quantum, audit) — the real Phase-2 swap is dropping in the
 * PrismaX* classes that already sit next to each InMemoryX* class; nothing
 * above this file changes when that happens. Compliance/Notification stay on
 * their Prisma stubs since they're explicitly Phase 2/optional-for-MVP scope.
 */
async function createApp() {
  const prismaClient: unknown = undefined;
  const eventPublisher = new InMemoryEventPublisher();

  const tenantRepository = new InMemoryTenantRepository();
  const userRepository = new InMemoryUserRepository();
  const roleRepository = new InMemoryRoleRepository();
  const identity = createIdentityModule({ tenantRepository, userRepository, roleRepository });

  const assetRepository = new InMemoryAssetRepository();
  const asset = createAssetModule({ assetRepository, eventPublisher });

  const complianceMappingRepository = new PrismaComplianceMappingRepository(prismaClient);
  const compliance = createComplianceModule({
    frameworkRepository: new PrismaFrameworkRepository(prismaClient),
    complianceMappingRepository,
    // Phase 4: swap for the real RegulatoryTraceabilityService implementation.
    traceabilityService: { traceAssetToRegulation: async () => [] },
  });

  const riskRepository = new InMemoryRiskRepository();
  const risk = createRiskModule({
    riskRepository,
    riskScoringService: new RiskScoringServiceImpl({ assetRepository }),
    eventPublisher,
  });

  const financialExposureRepository = new InMemoryFinancialExposureRepository();
  const financial = createFinancialModule({
    financialExposureRepository,
    riskRepository,
    qRiskAggregationService: new QRiskAggregationServiceImpl({ assetRepository, riskRepository }),
    eventPublisher,
  });

  const quantum = createQuantumModule({
    optimizationJobRepository: new InMemoryOptimizationJobRepository(),
    // MVP: classical-only greedy solver. HttpQuantumSolverGateway(quantumRunnerBaseUrl)
    // is the real Phase 5 swap once apps/quantum-runner's Qiskit/PennyLane
    // service exists — same interface, no caller changes.
    quantumSolverGateway: new GreedyClassicalSolverGateway(),
    eventPublisher,
  });

  const auditEventRepository = new InMemoryAuditEventRepository();
  const audit = createAuditModule({ auditEventRepository });

  // Cross-cutting: every domain event, from every context, reaches Audit (ARCHITECTURE.md §8).
  eventPublisher.subscribe("*", (envelope) => audit.recordAuditEvent.execute(envelope).then(() => undefined));

  const notification = createNotificationModule({
    notificationRepository: new PrismaNotificationRepository(prismaClient),
  });

  const seed = await seedDemoTenant({ tenantRepository, userRepository, roleRepository });
  log.info("demo tenant seeded", { tenantId: seed.tenantId, adminEmail: seed.adminEmail });
  // Deliberately NOT via the structured logger (which would redact it, correctly)
  // — this is a one-time operator convenience for the hackathon demo, not an
  // application log line, and must never run when NODE_ENV=production.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`Demo login: ${seed.adminEmail} / ${seed.adminPassword}`);
  }

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLoggerMiddleware());

  // /auth is the only unauthenticated module (ARCHITECTURE.md §7).
  app.use("/api/v1", createIdentityRouter(identity));

  const authenticated = express.Router();
  authenticated.use(requireAuth(), tenantContextMiddleware());
  authenticated.use(createAssetRouter(asset));
  authenticated.use(createComplianceRouter(compliance));
  authenticated.use(createRiskRouter(risk));
  authenticated.use(createFinancialRouter(financial));
  authenticated.use(createQuantumRouter(quantum));
  authenticated.use(createAuditRouter(audit));
  authenticated.use(createNotificationRouter(notification));
  app.use("/api/v1", authenticated);

  app.use(errorHandlerMiddleware());

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().then((app) => {
    app.listen(port, () => {
      log.info("KAIRON API listening", { port });
    });
  });
}

export { createApp };
