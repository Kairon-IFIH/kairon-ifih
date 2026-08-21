import { asAssetId, asTenantId, ValidationError } from "@kairon/shared-kernel";
import { Asset, AssetClassifiedEvent, AssetDiscoveredEvent, Criticality, DataClassification, RegulatoryScope } from "../domain";

const tenantId = asTenantId("tenant-1");

function makeAsset() {
  return Asset.create(asAssetId("asset-1"), tenantId, {
    name: "Core Payment API",
    assetType: "API",
    criticality: Criticality.create("CRITICAL"),
    dataClassification: DataClassification.create("CONFIDENTIAL"),
    regulatoryScope: RegulatoryScope.create(),
  });
}

describe("Criticality", () => {
  it("maps level to a weight", () => {
    expect(Criticality.create("LOW").weight).toBe(1);
    expect(Criticality.create("CRITICAL").weight).toBe(4);
  });
});

describe("Asset.create", () => {
  it("rejects an empty name", () => {
    expect(() =>
      Asset.create(asAssetId("x"), tenantId, {
        name: "",
        assetType: "API",
        criticality: Criticality.create("LOW"),
        dataClassification: DataClassification.create("PUBLIC"),
        regulatoryScope: RegulatoryScope.create(),
      })
    ).toThrow(ValidationError);
  });

  it("raises AssetDiscovered", () => {
    const asset = makeAsset();
    const events = asset.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(AssetDiscoveredEvent);
    const event = events[0] as AssetDiscoveredEvent;
    expect(event.assetId).toBe(asset.id);
    expect(event.criticality).toBe("CRITICAL");
  });

  it("pullDomainEvents drains the buffer", () => {
    const asset = makeAsset();
    asset.pullDomainEvents();
    expect(asset.pullDomainEvents()).toHaveLength(0);
  });
});

describe("Asset.classify", () => {
  it("updates classification and raises AssetClassified", () => {
    const asset = makeAsset();
    asset.pullDomainEvents();

    asset.classify(DataClassification.create("RESTRICTED"), RegulatoryScope.create(["DPDP"]));

    expect(asset.dataClassification.level).toBe("RESTRICTED");
    expect(asset.regulatoryScope.frameworkCodes).toEqual(["DPDP"]);

    const events = asset.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(AssetClassifiedEvent);
  });
});
