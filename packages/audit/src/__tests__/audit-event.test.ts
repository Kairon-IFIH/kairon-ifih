import { asAssetId, asAuditEventId, asTenantId, asUserId, ValidationError } from "@kairon/shared-kernel";
import { ActorRef, AuditEvent, BeforeAfterDiff } from "../domain";
import { InMemoryAuditEventRepository } from "../infrastructure";
import { RecordAuditEventUseCaseImpl } from "../application";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";

describe("AuditEvent.record", () => {
  it("rejects missing action/entityType/entityId", () => {
    expect(() =>
      AuditEvent.record(asAuditEventId("evt-1"), {
        tenantId: asTenantId("tenant-1"),
        timestamp: new Date(),
        actor: ActorRef.system(),
        action: "",
        entityType: "Asset",
        entityId: "asset-1",
        diff: BeforeAfterDiff.create({}, {}),
      })
    ).toThrow(ValidationError);
  });

  it("constructs a valid record", () => {
    const event = AuditEvent.record(asAuditEventId("evt-2"), {
      tenantId: asTenantId("tenant-1"),
      timestamp: new Date(),
      actor: ActorRef.create(asUserId("user-1"), "Jane"),
      action: "AssetDiscovered",
      entityType: "Asset",
      entityId: "asset-1",
      diff: BeforeAfterDiff.create({}, { name: "Core API" }),
    });
    expect(event.action).toBe("AssetDiscovered");
    expect(event.diff.after).toEqual({ name: "Core API" });
  });
});

describe("InMemoryAuditEventRepository", () => {
  it("has no update/delete methods (append-only by construction)", () => {
    const repo = new InMemoryAuditEventRepository();
    expect((repo as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((repo as unknown as Record<string, unknown>).delete).toBeUndefined();
  });

  it("isolates events by tenant", async () => {
    const repo = new InMemoryAuditEventRepository();
    const tenantA = asTenantId("tenant-a");
    const tenantB = asTenantId("tenant-b");

    await repo.append(
      AuditEvent.record(asAuditEventId("evt-a"), {
        tenantId: tenantA,
        timestamp: new Date(),
        actor: ActorRef.system(),
        action: "AssetDiscovered",
        entityType: "Asset",
        entityId: "asset-1",
        diff: BeforeAfterDiff.create({}, {}),
      })
    );
    await repo.append(
      AuditEvent.record(asAuditEventId("evt-b"), {
        tenantId: tenantB,
        timestamp: new Date(),
        actor: ActorRef.system(),
        action: "AssetDiscovered",
        entityType: "Asset",
        entityId: "asset-2",
        diff: BeforeAfterDiff.create({}, {}),
      })
    );

    const ctxA = { tenantId: tenantA, organizationId: "o" as never, userId: "u" as never, roles: [] };
    const resultsA = await repo.findByEntity(ctxA, "Asset", "asset-1");
    const resultsB = await repo.findByEntity(ctxA, "Asset", "asset-2");
    expect(resultsA).toHaveLength(1);
    expect(resultsB).toHaveLength(0); // asset-2's audit event belongs to tenant-b
  });
});

describe("RecordAuditEventUseCaseImpl", () => {
  it("maps a domain event envelope into an AuditEvent and appends it", async () => {
    const repo = new InMemoryAuditEventRepository();
    const useCase = new RecordAuditEventUseCaseImpl({ auditEventRepository: repo });

    const envelope: AnyDomainEventEnvelope = {
      eventId: "evt-1",
      eventName: "AssetDiscovered",
      occurredAt: new Date().toISOString(),
      payload: {
        tenantId: asTenantId("tenant-1"),
        assetId: asAssetId("asset-1"),
        assetType: "API",
        criticality: "CRITICAL",
        timestamp: new Date().toISOString(),
      },
    };

    const result = await useCase.execute(envelope);
    expect(result.isSuccess).toBe(true);

    const ctx = { tenantId: "tenant-1" as never, organizationId: "o" as never, userId: "u" as never, roles: [] };
    const events = await repo.findByEntity(ctx, "Asset", "asset-1");
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("AssetDiscovered");
  });
});
