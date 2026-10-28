-- Each user may have only one active salon membership.
-- Inactive historical memberships are retained for auditing.
CREATE UNIQUE INDEX "SalonMembership_one_active_salon_per_user"
ON "SalonMembership" ("userId") WHERE "isActive" = true;
