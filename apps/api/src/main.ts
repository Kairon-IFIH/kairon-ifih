import express from "express";
import helmet from "helmet";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

import { InMemoryEventPublisher } from "@kairon/event-contracts";
import {
  createIdentityModule,
  createIdentityRouter,
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRoleRepository,
  PrismaTenantRepository,
  PrismaUserRepository,
  PrismaRoleRepository,
  seedDemoTenant,
} from "@kairon/identity";
import { createAssetModule, createAssetRouter, InMemoryAssetRepository, PrismaAssetRepository } from "@kairon/asset";
import {
  createComplianceModule,
  createComplianceRouter,
  InMemoryFrameworkRepository,
  InMemoryRegulationRepository,
  InMemoryControlRepository,
  InMemoryComplianceMappingRepository,
  PrismaFrameworkRepository,
  PrismaRegulationRepository,
  PrismaControlRepository,
  PrismaComplianceMappingRepository,
  RegulatoryTraceabilityServiceImpl,
  seedComplianceReferenceData,
} from "@kairon/compliance";
import { createRiskModule, createRiskRouter, InMemoryRiskRepository, PrismaRiskRepository, RiskScoringServiceImpl } from "@kairon/risk";
import {
  createFinancialModule,
  createFinancialRouter,
  InMemoryFinancialExposureRepository,
  PrismaFinancialExposureRepository,
  QRiskAggregationServiceImpl,
} from "@kairon/financial";
import {
  createQuantumModule,
  createQuantumRouter,
  InMemoryOptimizationJobRepository,
  PrismaOptimizationJobRepository,
  GreedyClassicalSolverGateway,
} from "@kairon/quantum";
import { createAuditModule, createAuditRouter, InMemoryAuditEventRepository, PrismaAuditEventRepository } from "@kairon/audit";
import {
  createQuantumScannerModule,
  createQuantumScannerRouter,
  InMemoryScanResultRepository,
  PrismaScanResultRepository,
  SimulatedCryptoScannerService,
} from "@kairon/quantum-scanner";
import {
  createNotificationModule,
  createNotificationRouter,
  InMemoryNotificationRepository,
  PrismaNotificationRepository,
  type RecipientResolver,
} from "@kairon/notification";
import { asUserId } from "@kairon/shared-kernel";

import { createLogger } from "@kairon/logger";

import { requireAuth } from "./middleware/auth.middleware";
import { tenantContextMiddleware } from "./middleware/tenant-context.middleware";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";

const log = createLogger("bootstrap");

/** Same demo tenant convention prisma/seed.ts writes — see that file for the source of truth. */
const DEMO_ADMIN_EMAIL = "admin@demo-bank.example";

/**
 * Composition root: this is the only file in the whole system allowed to know
 * about every bounded context at once. Everything above (domain/application
 * layers) stays ignorant of Express, Prisma, and each other.
 *
 * Persistence: in-memory when DATABASE_URL is unset (the original hackathon-cut
 * dev loop — `npm run dev` with no database needed), Prisma-backed against a
 * real Postgres otherwise. Data seeded via `npm run seed` (prisma/seed.ts) is
 * what makes the DB-backed mode "hold" across restarts/redeploys — this file
 * does not auto-seed the database, only the in-memory fallback.
 */
async function createApp() {
  const eventPublisher = new InMemoryEventPublisher();
  const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

  const tenantRepository = prisma ? new PrismaTenantRepository(prisma) : new InMemoryTenantRepository();
  const userRepository = prisma ? new PrismaUserRepository(prisma) : new InMemoryUserRepository();
  const roleRepository = prisma ? new PrismaRoleRepository(prisma) : new InMemoryRoleRepository();
  const identity = createIdentityModule({ tenantRepository, userRepository, roleRepository });

  const assetRepository = prisma ? new PrismaAssetRepository(prisma) : new InMemoryAssetRepository();
  const asset = createAssetModule({ assetRepository, eventPublisher });

  const frameworkRepository = prisma ? new PrismaFrameworkRepository(prisma) : new InMemoryFrameworkRepository();
  const regulationRepository = prisma ? new PrismaRegulationRepository(prisma) : new InMemoryRegulationRepository();
  const controlRepository = prisma ? new PrismaControlRepository(prisma) : new InMemoryControlRepository();
  const complianceMappingRepository = prisma
    ? new PrismaComplianceMappingRepository(prisma)
    : new InMemoryComplianceMappingRepository();
  if (!prisma) {
    // DB-backed reference data comes from `npm run seed` instead (idempotent,
    // operator-triggered) — auto-seeding here would re-insert on every restart.
    // The cast is safe under this guard: prisma is null, so these are
    // guaranteed to be the InMemory* instances constructed above.
    await seedComplianceReferenceData({
      frameworkRepository: frameworkRepository as InMemoryFrameworkRepository,
      regulationRepository: regulationRepository as InMemoryRegulationRepository,
      controlRepository: controlRepository as InMemoryControlRepository,
    });
  }
  const compliance = createComplianceModule({
    frameworkRepository,
    regulationRepository,
    controlRepository,
    complianceMappingRepository,
    traceabilityService: new RegulatoryTraceabilityServiceImpl({
      frameworkRepository,
      regulationRepository,
      controlRepository,
      complianceMappingRepository,
    }),
    eventPublisher,
  });

  const riskRepository = prisma ? new PrismaRiskRepository(prisma) : new InMemoryRiskRepository();
  const risk = createRiskModule({
    riskRepository,
    riskScoringService: new RiskScoringServiceImpl({ assetRepository }),
    eventPublisher,
  });

  const financialExposureRepository = prisma
    ? new PrismaFinancialExposureRepository(prisma)
    : new InMemoryFinancialExposureRepository();
  const financial = createFinancialModule({
    financialExposureRepository,
    riskRepository,
    qRiskAggregationService: new QRiskAggregationServiceImpl({ assetRepository, riskRepository }),
    eventPublisher,
  });

  const quantum = createQuantumModule({
    optimizationJobRepository: prisma ? new PrismaOptimizationJobRepository(prisma) : new InMemoryOptimizationJobRepository(),
    // MVP: classical-only greedy solver. HttpQuantumSolverGateway(quantumRunnerBaseUrl)
    // is the real Phase 5 swap once apps/quantum-runner's Qiskit/PennyLane
    // service exists — same interface, no caller changes.
    quantumSolverGateway: new GreedyClassicalSolverGateway(),
    eventPublisher,
  });

  const auditEventRepository = prisma ? new PrismaAuditEventRepository(prisma) : new InMemoryAuditEventRepository();
  const audit = createAuditModule({ auditEventRepository });

  const scanResultRepository = prisma ? new PrismaScanResultRepository(prisma) : new InMemoryScanResultRepository();
  const quantumScanner = createQuantumScannerModule({
    scanResultRepository,
    assetRepository,
    cryptoScannerService: new SimulatedCryptoScannerService(),
    eventPublisher,
  });

  // Cross-cutting: every domain event, from every context, reaches Audit (ARCHITECTURE.md §8).
  eventPublisher.subscribe("*", (envelope) => audit.recordAuditEvent.execute(envelope).then(() => undefined));

  // MVP: single-recipient resolver (the seeded tenant admin). A real
  // subscription/preference model is Phase 6 — see @kairon/notification's
  // RecipientResolver doc comment for why this seam exists.
  let recipientUserId = asUserId("user-demo-admin");
  if (!prisma) {
    const seed = await seedDemoTenant({ tenantRepository, userRepository, roleRepository });
    recipientUserId = asUserId(seed.adminUserId);
    log.info("demo tenant seeded", { tenantId: seed.tenantId, adminEmail: seed.adminEmail });
    // Deliberately NOT via the structured logger (which would redact it, correctly)
    // — this is a one-time operator convenience for the hackathon demo, not an
    // application log line, and must never run when NODE_ENV=production.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`Demo login: ${seed.adminEmail} / ${seed.adminPassword}`);
    }
  } else {
    const demoAdmin = await userRepository.findByEmail(DEMO_ADMIN_EMAIL);
    if (demoAdmin) {
      recipientUserId = demoAdmin.id;
    } else {
      log.info("no seeded demo admin found — run `npm run seed` to populate the database", {});
    }
  }

  const recipientResolver: RecipientResolver = {
    resolve: () => recipientUserId,
  };
  const notification = createNotificationModule({
    notificationRepository: prisma ? new PrismaNotificationRepository(prisma) : new InMemoryNotificationRepository(),
    recipientResolver,
  });
  eventPublisher.subscribe("OptimizationExecuted", (envelope) =>
    notification.notifyOnDomainEvent.execute(envelope).then(() => undefined)
  );

  const app = express();
  app.use(helmet());
  app.use(cors());
  // CSV import reads req.body as raw text (asset/src/presentation.ts) — must be
  // parsed as text, not JSON, and must run before the global json() parser below.
  app.use("/api/v1/assets/import", express.text({ type: () => true }));
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
  authenticated.use(createQuantumScannerRouter(quantumScanner));

  authenticated.post("/ai/overview", express.json(), async (req, res, next) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({ success: false, message: "AI overview is not configured", errors: [] });
        return;
      }
      const metrics = req.body?.metrics ?? {};
      const prompt = `You are a risk analyst for a financial institution. Based on this JSON snapshot of the institution's risk platform, write a short executive overview (3-5 sentences) summarizing the current risk posture, then a "Recommended actions" list of 3 concise bullet points on what to do next. Be direct and specific to the numbers given, not generic advice.\n\nData:\n${JSON.stringify(metrics)}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        log.error("gemini request failed", { status: geminiRes.status, errText });
        res.status(502).json({ success: false, message: "AI provider error", errors: [] });
        return;
      }
      const geminiBody = (await geminiRes.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = geminiBody.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      res.status(200).json({ success: true, data: { text }, message: "OK" });
    } catch (err) {
      next(err);
    }
  });

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
