import request from "supertest";
import type { Express } from "express";
import { createApp } from "../main";

describe("KAIRON API — end-to-end MVP workflow", () => {
  let app: Express;
  let accessToken: string;

  beforeAll(async () => {
    app = await createApp();
  });

  it("rejects bad credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@demo-bank.example", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("logs in with the seeded demo admin", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@demo-bank.example", password: "changeme123" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    accessToken = res.body.data.accessToken;
  });

  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/v1/assets");
    expect(res.status).toBe(401);
  });

  it("runs the full asset -> risk -> financial -> quantum -> audit workflow", async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };

    const assetRes = await request(app)
      .post("/api/v1/assets")
      .set(auth)
      .send({
        name: "Core Payment API",
        assetType: "API",
        criticality: "CRITICAL",
        dataClassification: "CONFIDENTIAL",
      });
    expect(assetRes.status).toBe(201);
    const assetId = assetRes.body.data.id;

    const riskRes = await request(app).post("/api/v1/risks/calculate").set(auth).send({ assetId });
    expect(riskRes.status).toBe(201);
    expect(riskRes.body.data.props.score.props.level).toBe("HIGH");
    const riskId = riskRes.body.data.id;

    const exposureRes = await request(app).post("/api/v1/financial/exposures").set(auth).send({ riskId });
    expect(exposureRes.status).toBe(201);
    expect(exposureRes.body.data.props.financialExposure.props.amount).toBeGreaterThan(0);

    const qRiskRes = await request(app).get("/api/v1/financial/q-risk").set(auth);
    expect(qRiskRes.status).toBe(200);
    expect(qRiskRes.body.data.qRisk).toBeGreaterThanOrEqual(0);

    const jobRes = await request(app)
      .post("/api/v1/optimization-jobs")
      .set(auth)
      .send({
        candidateActions: [
          { actionId: "11111111-1111-1111-1111-111111111111", cost: 1000000, riskReduction: 0.4 },
          { actionId: "22222222-2222-2222-2222-222222222222", cost: 500000, riskReduction: 0.25 },
        ],
        budget: 1500000,
        currency: "INR",
        mandatoryActionIds: [],
      });
    expect(jobRes.status).toBe(202);
    const jobId = jobRes.body.data.jobId;

    const jobResultRes = await request(app).get(`/api/v1/optimization-jobs/${jobId}`).set(auth);
    expect(jobResultRes.status).toBe(200);
    expect(jobResultRes.body.data.props.status).toBe("COMPLETED");

    const auditRes = await request(app).get("/api/v1/audit?page=1&pageSize=50").set(auth);
    expect(auditRes.status).toBe(200);
    const actions = auditRes.body.data.items.map((e: { props: { action: string } }) => e.props.action);
    expect(actions).toEqual(
      expect.arrayContaining(["AssetDiscovered", "RiskCalculated", "FinancialExposureQuantified", "OptimizationExecuted"])
    );
  });

  it("returns a typed 404 for a nonexistent asset", async () => {
    const res = await request(app)
      .get("/api/v1/assets/00000000-0000-0000-0000-000000000000")
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
