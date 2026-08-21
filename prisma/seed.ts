/**
 * Demo data for the "GIFT City Demo Bank IBU" tenant — enough that every page
 * (Dashboard, Assets, Risks, Financial, Optimization, Compliance, Audit)
 * renders full instead of empty. Run with `npm run seed`.
 *
 * Idempotent: truncates every table it owns before writing, so re-running
 * this after a redeploy always leaves the same clean demo state rather than
 * accumulating duplicates.
 *
 * Deliberately bypasses the HTTP layer and goes through the same domain
 * factories (`Asset.create`, `Risk.create`, ...) and Prisma repositories the
 * live API uses — so what lands in the database is exactly what a real
 * request would have produced, not a hand-shaped approximation of it.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  asAssetId,
  asAuditEventId,
  asComplianceMappingId,
  asControlId,
  asEvidenceId,
  asFinancialExposureId,
  asFrameworkId,
  asNotificationId,
  asOptimizationJobId,
  asOrganizationId,
  asRegulationId,
  asRiskId,
  asRoleId,
  asTenantId,
  asUserId,
  CurrencyCode,
  Money,
  TenantContext,
} from "@kairon/shared-kernel";
import { defaultPermissionsForRole, ROLE_NAMES, RoleName, User } from "@kairon/identity";
import { Asset, Criticality, CriticalityLevel, DataClassification, DataClassificationLevel, PrismaAssetRepository, RegulatoryScope } from "@kairon/asset";
import { Impact, Likelihood, Risk, RiskScore, PrismaRiskRepository } from "@kairon/risk";
import { ExpectedLoss, FinancialExposure, PrismaFinancialExposureRepository, ResidualRisk } from "@kairon/financial";
import { ComplianceMapping, Evidence, GapStatus, GapStatusValue, PrismaComplianceMappingRepository } from "@kairon/compliance";
import {
  BudgetConstraint,
  CandidateAction,
  GreedyClassicalSolverGateway,
  ObjectiveFunction,
  OptimizationJob,
  PrismaOptimizationJobRepository,
} from "@kairon/quantum";
import { ActorRef, AuditEvent, BeforeAfterDiff, PrismaAuditEventRepository } from "@kairon/audit";
import { Notification, PrismaNotificationRepository } from "@kairon/notification";

const prisma = new PrismaClient();

const TENANT_ID = asTenantId("demo-tenant");
const ORG_ID = asOrganizationId("demo-org");
const CURRENCY: CurrencyCode = "INR";
const DEMO_PASSWORD = "changeme123";

// ---- narrative clock: spreads seeded events across real history so the
// dashboard's exposure river / signal feed reads as a timeline, not a burst.
// Started generously in the past (worst-case total tick budget below is
// ~58 days) — GetAuditTrailUseCaseImpl defaults its query window to
// [epoch, now], so any timestamp that drifted past "now" would silently
// vanish from every audit-backed view. ----
let clock = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000);
function tick(hoursMin: number, hoursMax: number): Date {
  const hours = hoursMin + Math.random() * (hoursMax - hoursMin);
  clock = new Date(clock.getTime() + hours * 60 * 60 * 1000);
  if (clock.getTime() > Date.now()) {
    throw new Error(
      "seed clock drifted into the future — GetAuditTrailUseCaseImpl defaults to [epoch, now], so any event timestamped past 'now' silently disappears from every audit-backed view. Push the clock's starting offset further back."
    );
  }
  return clock;
}

const auditEventRepository = new PrismaAuditEventRepository(prisma);
const ENTITY_TYPE_BY_EVENT: Record<string, string> = {
  AssetDiscovered: "Asset",
  AssetClassified: "Asset",
  ComplianceMapped: "ComplianceMapping",
  RiskCalculated: "Risk",
  FinancialExposureQuantified: "FinancialExposure",
  OptimizationExecuted: "OptimizationJob",
};

async function recordAudit(
  actor: ActorRef,
  action: string,
  entityId: string,
  payload: Record<string, unknown>,
  timestamp: Date
): Promise<void> {
  await auditEventRepository.append(
    AuditEvent.record(asAuditEventId(randomUUID()), {
      tenantId: TENANT_ID,
      timestamp,
      actor,
      action,
      entityType: ENTITY_TYPE_BY_EVENT[action] ?? "Unknown",
      entityId,
      diff: BeforeAfterDiff.create({}, payload),
    })
  );
}

async function reset(): Promise<void> {
  // FK-dependency order, leaves.first.
  await prisma.notification.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.optimizationResult.deleteMany();
  await prisma.optimizationJob.deleteMany();
  await prisma.complianceMapping.deleteMany();
  await prisma.control.deleteMany();
  await prisma.regulation.deleteMany();
  await prisma.framework.deleteMany();
  await prisma.financialExposure.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.tenant.deleteMany();
}

interface SeededUser {
  email: string;
  roleName: RoleName;
}

async function seedIdentity(): Promise<{ ctx: TenantContext; adminActor: ActorRef; users: SeededUser[] }> {
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "Demo Bank" } });
  await prisma.organization.create({ data: { id: ORG_ID, tenantId: TENANT_ID, name: "GIFT City Demo Bank IBU" } });

  const roleIdByName: Record<RoleName, string> = {
    TenantAdmin: "role-tenant-admin",
    ComplianceOfficer: "role-compliance-officer",
    RiskAnalyst: "role-risk-analyst",
    Auditor: "role-auditor",
  };

  for (const name of ROLE_NAMES) {
    await prisma.role.create({
      data: {
        id: roleIdByName[name],
        tenantId: TENANT_ID,
        name,
        permissions: defaultPermissionsForRole(name).map((p) => ({ resource: p.resource, action: p.action })),
      },
    });
  }

  const users: SeededUser[] = [
    { email: "admin@demo-bank.example", roleName: "TenantAdmin" },
    { email: "compliance@demo-bank.example", roleName: "ComplianceOfficer" },
    { email: "risk.analyst@demo-bank.example", roleName: "RiskAnalyst" },
    { email: "auditor@demo-bank.example", roleName: "Auditor" },
  ];

  let adminUserId = "user-demo-admin";
  for (const [i, u] of users.entries()) {
    const id = i === 0 ? adminUserId : `user-demo-${u.roleName.toLowerCase()}`;
    await prisma.user.create({
      data: {
        id,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        email: u.email,
        passwordHash: User.hashPassword(DEMO_PASSWORD),
      },
    });
    await prisma.userRole.create({ data: { userId: id, roleId: roleIdByName[u.roleName] } });
    if (i === 0) adminUserId = id;
  }

  const ctx: TenantContext = {
    tenantId: TENANT_ID,
    organizationId: ORG_ID,
    userId: asUserId(adminUserId),
    roles: ["TenantAdmin"],
  };
  const adminActor = ActorRef.create(asUserId(adminUserId), "Demo Admin");
  return { ctx, adminActor, users };
}

interface ControlSeed {
  id: string;
  regulationId: string;
  name: string;
  maturityLevel: number;
}

async function seedCompliance(): Promise<{ controlsByFramework: Record<"DPDP" | "ISO27001", ControlSeed[]> }> {
  const dpdpFrameworkId = asFrameworkId("framework-dpdp");
  const dpdpRegId = asRegulationId("dpdp-reg-data-security");
  await prisma.framework.create({ data: { id: dpdpFrameworkId, code: "DPDP", version: "2023" } });
  await prisma.regulation.create({
    data: { id: dpdpRegId, frameworkId: dpdpFrameworkId, name: "Reasonable Security Safeguards", clauseReference: "DPDP Act 2023, Section 8(5)" },
  });
  const dpdpControls: ControlSeed[] = [
    { id: "dpdp-control-encryption", regulationId: dpdpRegId, name: "Encryption of Personal Data at Rest", maturityLevel: 5 },
    { id: "dpdp-control-retention", regulationId: dpdpRegId, name: "Data Retention Limits", maturityLevel: 3 },
    { id: "dpdp-control-breach-notify", regulationId: dpdpRegId, name: "Breach Notification Process", maturityLevel: 1 },
  ];

  const isoFrameworkId = asFrameworkId("framework-iso27001");
  const isoRegId = asRegulationId("iso-reg-access-control");
  await prisma.framework.create({ data: { id: isoFrameworkId, code: "ISO27001", version: "2022" } });
  await prisma.regulation.create({
    data: { id: isoRegId, frameworkId: isoFrameworkId, name: "Access Control", clauseReference: "ISO/IEC 27001:2022 Annex A.8" },
  });
  const isoControls: ControlSeed[] = [
    { id: "iso-control-mfa", regulationId: isoRegId, name: "Multi-Factor Authentication for Privileged Access", maturityLevel: 4 },
    { id: "iso-control-least-privilege", regulationId: isoRegId, name: "Least Privilege Enforcement", maturityLevel: 2 },
    { id: "iso-control-vendor-access", regulationId: isoRegId, name: "Third-Party Access Review", maturityLevel: 0 },
  ];

  for (const c of [...dpdpControls, ...isoControls]) {
    await prisma.control.create({
      data: { id: c.id, regulationId: c.regulationId, name: c.name, maturityLevel: c.maturityLevel },
    });
  }

  return { controlsByFramework: { DPDP: dpdpControls, ISO27001: isoControls } };
}

interface AssetSeed {
  name: string;
  assetType: string;
  criticality: CriticalityLevel;
  dataClassification: DataClassificationLevel;
  regulatoryScope: ("DPDP" | "ISO27001")[];
  /** Omit to leave this asset unscored — the dashboard briefing calls this out honestly. */
  controlEffectiveness?: number;
}

const ASSET_SEEDS: AssetSeed[] = [
  { name: "Core Banking Platform", assetType: "Application", criticality: "CRITICAL", dataClassification: "RESTRICTED", regulatoryScope: ["DPDP", "ISO27001"], controlEffectiveness: 0.55 },
  { name: "SWIFT Payment Gateway", assetType: "Application", criticality: "CRITICAL", dataClassification: "RESTRICTED", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.6 },
  { name: "Customer KYC Database", assetType: "Database", criticality: "CRITICAL", dataClassification: "RESTRICTED", regulatoryScope: ["DPDP", "ISO27001"], controlEffectiveness: 0.35 },
  { name: "AML Transaction Monitoring", assetType: "Application", criticality: "CRITICAL", dataClassification: "RESTRICTED", regulatoryScope: ["DPDP", "ISO27001"], controlEffectiveness: 0.4 },
  { name: "Customer Data Warehouse", assetType: "Database", criticality: "CRITICAL", dataClassification: "RESTRICTED", regulatoryScope: ["DPDP", "ISO27001"], controlEffectiveness: 0.3 },
  { name: "Treasury Management System", assetType: "Application", criticality: "HIGH", dataClassification: "CONFIDENTIAL", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.5 },
  { name: "Trading Execution Platform", assetType: "Application", criticality: "HIGH", dataClassification: "CONFIDENTIAL", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.45 },
  { name: "Credit Risk Engine", assetType: "Application", criticality: "HIGH", dataClassification: "CONFIDENTIAL", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.5 },
  { name: "Mobile Banking App", assetType: "Application", criticality: "HIGH", dataClassification: "CONFIDENTIAL", regulatoryScope: ["DPDP"], controlEffectiveness: 0.42 },
  { name: "Internet Banking Portal", assetType: "Application", criticality: "HIGH", dataClassification: "CONFIDENTIAL", regulatoryScope: ["DPDP"], controlEffectiveness: 0.38 },
  { name: "Regulatory Reporting Engine", assetType: "Application", criticality: "HIGH", dataClassification: "CONFIDENTIAL", regulatoryScope: ["DPDP", "ISO27001"], controlEffectiveness: 0.55 },
  { name: "Backup & DR Storage Cluster", assetType: "Infrastructure", criticality: "HIGH", dataClassification: "RESTRICTED", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.6 },
  { name: "API Gateway", assetType: "Infrastructure", criticality: "HIGH", dataClassification: "INTERNAL", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.48 },
  { name: "Document Management System", assetType: "Application", criticality: "MEDIUM", dataClassification: "CONFIDENTIAL", regulatoryScope: ["DPDP"], controlEffectiveness: 0.4 },
  { name: "VPN Concentrator", assetType: "Network", criticality: "MEDIUM", dataClassification: "INTERNAL", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.3 },
  { name: "HR Information System", assetType: "Application", criticality: "MEDIUM", dataClassification: "CONFIDENTIAL", regulatoryScope: ["DPDP"], controlEffectiveness: 0.45 },
  { name: "Log Aggregation Platform (SIEM)", assetType: "Infrastructure", criticality: "MEDIUM", dataClassification: "INTERNAL", regulatoryScope: ["ISO27001"], controlEffectiveness: 0.5 },
  { name: "Cloud Object Storage Bucket", assetType: "Infrastructure", criticality: "MEDIUM", dataClassification: "CONFIDENTIAL", regulatoryScope: ["DPDP"], controlEffectiveness: 0.35 },
  { name: "Corporate Email Server", assetType: "Infrastructure", criticality: "MEDIUM", dataClassification: "INTERNAL", regulatoryScope: [] },
  { name: "Branch Network Router Fleet", assetType: "Network", criticality: "MEDIUM", dataClassification: "INTERNAL", regulatoryScope: [] },
  { name: "Vendor Management Portal", assetType: "Application", criticality: "LOW", dataClassification: "INTERNAL", regulatoryScope: [] },
  { name: "Employee Learning Portal", assetType: "SaaS", criticality: "LOW", dataClassification: "INTERNAL", regulatoryScope: [] },
];

const IMPACT_PER_CRITICALITY_POINT_INR = 25_00_000; // matches RiskScoringServiceImpl's disclosed baseline

async function seedAssetsRisksAndExposures(
  assetRepository: PrismaAssetRepository,
  riskRepository: PrismaRiskRepository,
  financialExposureRepository: PrismaFinancialExposureRepository,
  ctx: TenantContext,
  adminActor: ActorRef
): Promise<{ assetIds: string[]; scoredAssetIds: string[] }> {
  const assetIds: string[] = [];
  const scoredAssetIds: string[] = [];

  for (const seed of ASSET_SEEDS) {
    const assetId = asAssetId(randomUUID());
    const criticality = Criticality.create(seed.criticality);
    const asset = Asset.create(assetId, TENANT_ID, {
      name: seed.name,
      assetType: seed.assetType,
      criticality,
      dataClassification: DataClassification.create(seed.dataClassification),
      regulatoryScope: RegulatoryScope.create(seed.regulatoryScope),
    });
    await assetRepository.save(ctx, asset);
    assetIds.push(assetId);

    const discoveredAt = tick(2, 10);
    await recordAudit(
      adminActor,
      "AssetDiscovered",
      assetId,
      { tenantId: TENANT_ID, assetId, assetType: seed.assetType, criticality: seed.criticality, timestamp: discoveredAt.toISOString() },
      discoveredAt
    );

    if (seed.regulatoryScope.length > 0) {
      const classifiedAt = tick(1, 6);
      await recordAudit(
        adminActor,
        "AssetClassified",
        assetId,
        {
          tenantId: TENANT_ID,
          assetId,
          dataClassification: seed.dataClassification,
          regulatoryScope: seed.regulatoryScope,
          timestamp: classifiedAt.toISOString(),
        },
        classifiedAt
      );
    }

    if (seed.controlEffectiveness === undefined) continue;

    const likelihood = Likelihood.create(criticality.weight / 4);
    const impact = Impact.create(criticality.weight * IMPACT_PER_CRITICALITY_POINT_INR, CURRENCY);
    const score = RiskScore.calculate(likelihood, impact, seed.controlEffectiveness);
    const riskId = asRiskId(randomUUID());
    const risk = Risk.create(riskId, TENANT_ID, { assetId, factors: [], likelihood, impact, score });
    await riskRepository.save(ctx, risk);
    scoredAssetIds.push(assetId);

    const riskAt = tick(3, 18);
    await recordAudit(
      adminActor,
      "RiskCalculated",
      riskId,
      {
        tenantId: TENANT_ID,
        riskId,
        assetId,
        likelihood: likelihood.value,
        impact: impact.money.amount,
        riskScore: score.inherentScore,
        residualRisk: score.residualScore,
        timestamp: riskAt.toISOString(),
      },
      riskAt
    );

    const annualizedLoss = impact.money.multiply(score.residualScore / 100);
    const exposureId = asFinancialExposureId(randomUUID());
    const exposure = FinancialExposure.create(exposureId, TENANT_ID, {
      assetId,
      riskId,
      expectedLoss: ExpectedLoss.create(exposureId, { annualizedAmount: annualizedLoss }),
      financialExposure: annualizedLoss,
      residualRisk: ResidualRisk.create(annualizedLoss),
    });
    await financialExposureRepository.save(ctx, exposure);

    const exposureAt = tick(2, 12);
    await recordAudit(
      adminActor,
      "FinancialExposureQuantified",
      assetId,
      {
        tenantId: TENANT_ID,
        assetId,
        expectedLoss: annualizedLoss.amount,
        financialExposure: annualizedLoss.amount,
        currency: annualizedLoss.currency,
        timestamp: exposureAt.toISOString(),
      },
      exposureAt
    );
  }

  return { assetIds, scoredAssetIds };
}

async function seedComplianceMappings(
  complianceMappingRepository: PrismaComplianceMappingRepository,
  ctx: TenantContext,
  adminActor: ActorRef,
  assetSeedsWithIds: { id: string; seed: AssetSeed }[],
  controlsByFramework: Record<"DPDP" | "ISO27001", ControlSeed[]>
): Promise<void> {
  for (const { id: assetId, seed } of assetSeedsWithIds) {
    let rotation = 0;
    for (const framework of seed.regulatoryScope) {
      const controls = controlsByFramework[framework];
      const control = controls[rotation % controls.length];
      rotation += 1;

      const mappingId = asComplianceMappingId(randomUUID());
      const gapStatus = GapStatus.fromControlMaturity(control.maturityLevel);
      const mapping = ComplianceMapping.create(mappingId, TENANT_ID, {
        assetId: asAssetId(assetId),
        controlId: asControlId(control.id),
        gapStatus,
        evidence: [
          Evidence.create(asEvidenceId(randomUUID()), {
            description: `${control.name} reviewed for ${seed.name}`,
            documentRef: `evidence/${seed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${control.id}.pdf`,
          }),
        ],
      });
      await complianceMappingRepository.save(ctx, mapping);

      const mappedAt = tick(2, 14);
      await recordAudit(
        adminActor,
        "ComplianceMapped",
        assetId,
        { tenantId: TENANT_ID, assetId, controlId: control.id, gapStatus: gapStatus.value, timestamp: mappedAt.toISOString() },
        mappedAt
      );
    }
  }
}

interface OptimizationJobSeed {
  label: string;
  budget: number;
  mandatoryActionIds: string[];
  candidates: { actionId: string; cost: number; riskReduction: number }[];
}

const OPTIMIZATION_JOB_SEEDS: OptimizationJobSeed[] = [
  {
    label: "Q3 Remediation Sprint — Critical Systems",
    budget: 80_00_000,
    mandatoryActionIds: ["mfa-rollout"],
    candidates: [
      { actionId: "mfa-rollout", cost: 12_00_000, riskReduction: 0.22 },
      { actionId: "encrypt-data-at-rest", cost: 25_00_000, riskReduction: 0.3 },
      { actionId: "waf-upgrade", cost: 15_00_000, riskReduction: 0.15 },
      { actionId: "soc-monitoring-contract", cost: 30_00_000, riskReduction: 0.25 },
      { actionId: "legacy-vpn-patch", cost: 8_00_000, riskReduction: 0.1 },
    ],
  },
  {
    label: "Compliance Gap Closure — DPDP Alignment",
    budget: 35_00_000,
    mandatoryActionIds: ["breach-notification-workflow"],
    candidates: [
      { actionId: "breach-notification-workflow", cost: 6_00_000, riskReduction: 0.18 },
      { actionId: "data-retention-automation", cost: 10_00_000, riskReduction: 0.2 },
      { actionId: "dlp-rollout", cost: 18_00_000, riskReduction: 0.28 },
      { actionId: "vendor-access-review", cost: 5_00_000, riskReduction: 0.12 },
    ],
  },
];

async function seedOptimizationJobs(
  optimizationJobRepository: PrismaOptimizationJobRepository,
  ctx: TenantContext,
  adminActor: ActorRef,
  notificationRepository: PrismaNotificationRepository,
  adminUserId: string
): Promise<void> {
  const solver = new GreedyClassicalSolverGateway();

  for (const seed of OPTIMIZATION_JOB_SEEDS) {
    const jobId = asOptimizationJobId(randomUUID());
    const job = OptimizationJob.create(jobId, TENANT_ID, {
      objective: ObjectiveFunction.default(),
      constraints: [],
      candidateActions: seed.candidates.map(
        (c): CandidateAction => ({ actionId: c.actionId, cost: Money.create(c.cost, CURRENCY), riskReduction: c.riskReduction })
      ),
      mandatoryActionIds: seed.mandatoryActionIds,
      budgetConstraint: BudgetConstraint.create(Money.create(seed.budget, CURRENCY)),
    });

    job.markRunning();
    await solver.submitJob(job);
    const result = await solver.getResult(jobId);
    if (result) job.complete(result);
    await optimizationJobRepository.save(ctx, job);

    const executedAt = tick(6, 30);
    if (job.result) {
      await recordAudit(
        adminActor,
        "OptimizationExecuted",
        jobId,
        {
          tenantId: TENANT_ID,
          jobId,
          selectedActions: [...job.result.selectedActionIds],
          totalCost: job.result.totalCost.amount,
          riskReduction: job.result.riskReductionPercent,
          residualRisk: job.result.residualRisk.amount,
          timestamp: executedAt.toISOString(),
        },
        executedAt
      );

      const notification = Notification.create(asNotificationId(randomUUID()), {
        recipientUserId: asUserId(adminUserId),
        type: "OPTIMIZATION_COMPLETE",
        payload: {
          jobId,
          label: seed.label,
          selectedCount: job.result.selectedActionIds.length,
          totalCost: job.result.totalCost.amount,
          riskReductionPercent: job.result.riskReductionPercent,
        },
      });
      await notificationRepository.save(ctx, notification);
    }
  }
}

async function seedNotifications(notificationRepository: PrismaNotificationRepository, adminUserId: string, ctx: TenantContext): Promise<void> {
  const pending = Notification.create(asNotificationId(randomUUID()), {
    recipientUserId: asUserId(adminUserId),
    type: "REMEDIATION_PENDING_APPROVAL",
    payload: { actionId: "dlp-rollout", requestedBy: "risk.analyst@demo-bank.example" },
  });
  await notificationRepository.save(ctx, pending);

  const readEarlier = Notification.create(asNotificationId(randomUUID()), {
    recipientUserId: asUserId(adminUserId),
    type: "REMEDIATION_PENDING_APPROVAL",
    payload: { actionId: "vendor-access-review", requestedBy: "compliance@demo-bank.example" },
  });
  readEarlier.markRead();
  await notificationRepository.save(ctx, readEarlier);
}

async function main(): Promise<void> {
  console.log("Resetting demo data…");
  await reset();

  console.log("Seeding identity (tenant, org, roles, users)…");
  const { ctx, adminActor, users } = await seedIdentity();

  console.log("Seeding compliance reference data (DPDP + ISO27001)…");
  const { controlsByFramework } = await seedCompliance();

  console.log("Seeding assets, risks and financial exposures…");
  const assetRepository = new PrismaAssetRepository(prisma);
  const riskRepository = new PrismaRiskRepository(prisma);
  const financialExposureRepository = new PrismaFinancialExposureRepository(prisma);
  const { assetIds } = await seedAssetsRisksAndExposures(assetRepository, riskRepository, financialExposureRepository, ctx, adminActor);

  console.log("Seeding compliance mappings…");
  const complianceMappingRepository = new PrismaComplianceMappingRepository(prisma);
  const assetSeedsWithIds = ASSET_SEEDS.map((seed, i) => ({ id: assetIds[i], seed }));
  await seedComplianceMappings(complianceMappingRepository, ctx, adminActor, assetSeedsWithIds, controlsByFramework);

  console.log("Running optimization jobs through the greedy solver…");
  const optimizationJobRepository = new PrismaOptimizationJobRepository(prisma);
  const notificationRepository = new PrismaNotificationRepository(prisma);
  const adminUserId = ctx.userId;
  await seedOptimizationJobs(optimizationJobRepository, ctx, adminActor, notificationRepository, adminUserId);

  console.log("Seeding notifications…");
  await seedNotifications(notificationRepository, adminUserId, ctx);

  console.log("\nDone. Demo logins (password for all: %s):", DEMO_PASSWORD);
  for (const u of users) {
    console.log(`  ${u.roleName.padEnd(18)} ${u.email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
