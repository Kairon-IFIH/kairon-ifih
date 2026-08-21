import express from "express";
import helmet from "helmet";
import cors from "cors";

import { createIdentityModule, createIdentityRouter, PrismaTenantRepository, PrismaUserRepository, PrismaRoleRepository } from "@kairon/identity";
import { createAssetModule, createAssetRouter, PrismaAssetRepository } from "@kairon/asset";
import {
  createComplianceModule,
  createComplianceRouter,
  PrismaFrameworkRepository,
  PrismaComplianceMappingRepository,
} from "@kairon/compliance";
import { createRiskModule, createRiskRouter, PrismaRiskRepository } from "@kairon/risk";
import { createFinancialModule, createFinancialRouter, PrismaFinancialExposureRepository } from "@kairon/financial";
import {
  createQuantumModule,
  createQuantumRouter,
  PrismaOptimizationJobRepository,
  HttpQuantumSolverGateway,
} from "@kairon/quantum";
import { createAuditModule, createAuditRouter, PrismaAuditEventRepository } from "@kairon/audit";
import { createNotificationModule, createNotificationRouter, PrismaNotificationRepository } from "@kairon/notification";

import { requireAuth } from "./middleware/auth.middleware";
import { tenantContextMiddleware } from "./middleware/tenant-context.middleware";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";

/**
 * Composition root: this is the only file in the whole system allowed to know
 * about every bounded context at once. Everything above (domain/application
 * layers) stays ignorant of Express, Prisma, and each other.
 *
 * `prismaClient` is `undefined` until Phase 2 wires an actual PrismaClient —
 * every repository constructor currently accepts `unknown` for exactly this reason.
 */
function createApp() {
  const prismaClient: unknown = undefined;
  const quantumRunnerBaseUrl = process.env.QUANTUM_RUNNER_URL ?? "http://localhost:8001";

  const identity = createIdentityModule({
    tenantRepository: new PrismaTenantRepository(prismaClient),
    userRepository: new PrismaUserRepository(prismaClient),
    roleRepository: new PrismaRoleRepository(prismaClient),
  });

  const asset = createAssetModule({
    assetRepository: new PrismaAssetRepository(prismaClient),
  });

  const complianceMappingRepository = new PrismaComplianceMappingRepository(prismaClient);
  const compliance = createComplianceModule({
    frameworkRepository: new PrismaFrameworkRepository(prismaClient),
    complianceMappingRepository,
    // Phase 4: swap for the real RegulatoryTraceabilityService implementation.
    traceabilityService: { traceAssetToRegulation: async () => [] },
  });

  const risk = createRiskModule({
    riskRepository: new PrismaRiskRepository(prismaClient),
    // Phase 3: swap for the real RiskScoringService implementation.
    riskScoringService: { scoreAsset: async () => { throw new Error("not implemented"); } },
  });

  const financial = createFinancialModule({
    financialExposureRepository: new PrismaFinancialExposureRepository(prismaClient),
    // Phase 3/6: swap for the real QRiskAggregationService implementation.
    qRiskAggregationService: { calculateQRisk: async () => 0 },
  });

  const quantum = createQuantumModule({
    optimizationJobRepository: new PrismaOptimizationJobRepository(prismaClient),
    quantumSolverGateway: new HttpQuantumSolverGateway(quantumRunnerBaseUrl),
  });

  const audit = createAuditModule({
    auditEventRepository: new PrismaAuditEventRepository(prismaClient),
  });

  const notification = createNotificationModule({
    notificationRepository: new PrismaNotificationRepository(prismaClient),
  });

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

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
  createApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`KAIRON API listening on :${port}`);
  });
}

export { createApp };
