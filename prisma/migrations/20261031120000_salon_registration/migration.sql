CREATE TYPE "SalonRegistrationStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TABLE "SalonRegistrationRequest" (
 "id" TEXT NOT NULL,
 "applicantId" TEXT NOT NULL,
 "reviewedById" TEXT,
 "name" TEXT NOT NULL,
 "slug" TEXT NOT NULL,
 "phone" TEXT,
 "address" TEXT,
 "description" TEXT,
 "status" "SalonRegistrationStatus" NOT NULL DEFAULT 'PENDING',
 "rejectionReason" TEXT,
 "salonId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "reviewedAt" TIMESTAMP(3),
 CONSTRAINT "SalonRegistrationRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalonRegistrationRequest_applicantId_status_idx" ON "SalonRegistrationRequest"("applicantId","status");
CREATE INDEX "SalonRegistrationRequest_status_createdAt_idx" ON "SalonRegistrationRequest"("status","createdAt");
CREATE UNIQUE INDEX "SalonRegistrationRequest_one_pending_per_user" ON "SalonRegistrationRequest"("applicantId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "SalonRegistrationRequest_one_pending_per_slug" ON "SalonRegistrationRequest"("slug") WHERE "status" = 'PENDING';
ALTER TABLE "SalonRegistrationRequest" ADD CONSTRAINT "SalonRegistrationRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalonRegistrationRequest" ADD CONSTRAINT "SalonRegistrationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
