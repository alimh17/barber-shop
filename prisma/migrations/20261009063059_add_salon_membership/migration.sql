-- CreateTable
CREATE TABLE "SalonMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalonMembership_salonId_isActive_idx" ON "SalonMembership"("salonId", "isActive");

-- CreateIndex
CREATE INDEX "SalonMembership_userId_isActive_idx" ON "SalonMembership"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SalonMembership_userId_salonId_key" ON "SalonMembership"("userId", "salonId");

-- AddForeignKey
ALTER TABLE "SalonMembership" ADD CONSTRAINT "SalonMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonMembership" ADD CONSTRAINT "SalonMembership_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
