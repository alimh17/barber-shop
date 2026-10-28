# Salon tenant isolation

Each non-super-admin account belongs to exactly one salon. `SUPER_ADMIN` can access all salons.

## Customer onboarding

Send customers `/s/<salon-slug>`. The frontend redirects to `/login?salon=<salon-slug>` and submits `salonSlug` alongside the verified OTP. A new customer is created with one active `SalonMembership`. Existing customers cannot switch salons by following another invitation link.

## API boundaries

- `GET /api/salons/by-slug/:slug` exposes minimal public salon identity for invitation links.
- `GET /api/salons` and `GET /api/salons/:id` require login and are scoped to the current tenant, except for super admins.
- Customer barber listings, barber services, availability, booking, and appointment history are tenant-scoped on the server.
- Admin user lists and appointment management are scoped to their active salon membership.
- PostgreSQL partial unique index `SalonMembership_one_active_salon_per_user` prevents two active memberships per user, while retaining inactive historical memberships.

## Data migration

Before rollout, audit historical customer accounts without an active salon membership and appointments previously created across multiple salons. Do not auto-assign an account based on a guessed salon. Existing unassigned customers can enroll via their salon's link. Admin memberships must be reconciled before applying the unique index on any environment containing duplicates.

## Tests

- `e2e/tenant-registration.spec.ts`: OTP enrollment, foreign salon and barber/service/availability denial.
- `e2e/tenant-browser.spec.ts`: browser invitation link and booking salon selector isolation.
- `e2e/booking-multitenant.spec.ts`: cross-tenant administrator and barber authorization.

Run only against a local isolated test database. The tests use development OTP and create fixture records. Set `E2E_BASE_URL` and `E2E_API_URL` as appropriate.
