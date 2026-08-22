-- CreateTable
CREATE TABLE "crypto_scan_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "dataSensitivityTier" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "hndlActNow" BOOLEAN NOT NULL,
    "hndlSafeUntilYear" INTEGER,
    "qarsScore" DOUBLE PRECISION NOT NULL,
    "qarsRiskLevel" TEXT NOT NULL,
    "qarsRubric" JSONB NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crypto_scan_results_tenantId_idx" ON "crypto_scan_results"("tenantId");

-- CreateIndex
CREATE INDEX "crypto_scan_results_tenantId_assetId_idx" ON "crypto_scan_results"("tenantId", "assetId");

-- AddForeignKey
ALTER TABLE "crypto_scan_results" ADD CONSTRAINT "crypto_scan_results_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
