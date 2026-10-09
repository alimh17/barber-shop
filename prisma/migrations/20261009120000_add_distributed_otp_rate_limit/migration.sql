CREATE TABLE "OtpRateLimitEntry" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OtpRateLimitEntry_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "OtpRateLimitEntry_resetAt_idx"
ON "OtpRateLimitEntry" ("resetAt");
