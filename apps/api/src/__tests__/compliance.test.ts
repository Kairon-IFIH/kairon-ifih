import request from "supertest";
import type { Express } from "express";
import { createApp } from "../main";

describe("KAIRON API — compliance mapping and traceability", () => {
  let app: Express;
  let auth: { Authorization: string };
  let assetId: string;

  beforeAll(async () => {
    app = await createApp();
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@demo-bank.example", password: "changeme123" });
    auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const assetRes = await request(app)
      .post("/api/v1/assets")
      .set(auth)
      .send({ name: "Core Payment API", assetType: "API", criticality: "HIGH", dataClassification: "CONFIDENTIAL" });
    assetId = assetRes.body.data.id;
  });

  it("maps an asset to a seeded reference-data control (non-UUID id)", async () => {
    const res = await request(app)
      .post("/api/v1/compliance/mappings")
      .set(auth)
      .send({ assetId, controlId: "dpdp-control-encryption" });

    expect(res.status).toBe(201);
    expect(res.body.data.gapStatus).toBe("PARTIAL");
  });

  it("surfaces the mapping in gap analysis", async () => {
    const res = await request(app).get("/api/v1/compliance/gaps?page=1&pageSize=10").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it("traces the asset back to a specific regulation and clause", async () => {
    const res = await request(app).get(`/api/v1/compliance/assets/${assetId}/traceability`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].regulation.clauseReference).toBe("DPDP Act 2023, Section 8(5)");
    expect(res.body.data[0].framework.code).toBe("DPDP");
  });

  it("rejects mapping to an unknown control", async () => {
    const res = await request(app)
      .post("/api/v1/compliance/mappings")
      .set(auth)
      .send({ assetId, controlId: "does-not-exist" });
    expect(res.status).toBe(404);
  });
});
