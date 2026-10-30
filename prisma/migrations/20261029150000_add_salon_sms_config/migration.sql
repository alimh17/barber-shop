-- Tenant-scoped Kavenegar credentials. API keys are encrypted by the
-- application before persistence and are never returned by the API.
CREATE TABLE "SalonSmsConfig" (
    "salonId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "verifyTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalonSmsConfig_pkey" PRIMARY KEY ("salonId")
);

ALTER TABLE "OtpCode" ADD COLUMN "salonId" TEXT;
CREATE INDEX "OtpCode_salonId_phone_createdAt_idx" ON "OtpCode"("salonId", "phone", "createdAt");

ALTER TABLE "SalonSmsConfig"
ADD CONSTRAINT "SalonSmsConfig_salonId_fkey"
FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
