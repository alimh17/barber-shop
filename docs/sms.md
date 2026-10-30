# SMS / OTP delivery

OTP generation, hashing, expiry and rate limits remain in `src/otp` and `src/auth`. The delivery adapter is `src/otp/sms.service.ts`.

## Ownership model

- Each salon owns and pays for its Kavenegar account. An authorized salon admin configures it from `/settings/sms`.
- The API key is encrypted at rest with AES-256-GCM using `SMS_CREDENTIALS_ENCRYPTION_KEY`; only its last four characters are returned for identification.
- Login links include `salonSlug`. OTP creation and verification are scoped to that salon so a code cannot cross tenant boundaries.
- Requests without `salonSlug` may use the platform provider only when the phone already belongs to a `SUPER_ADMIN`.
- An active salon admin may use the platform provider for the initial login only while that salon has no SMS configuration. This closes the setup deadlock; after configuration, the fallback is no longer selected.

## Configuration

- `SMS_PROVIDER=mock`: development and automated tests only. No outbound request and no OTP in logs. Startup validation rejects it unless `NODE_ENV` is exactly `development` or `test`.
- `SMS_PROVIDER=kavenegar`: Kavenegar Verify Lookup API. Requires `KAVENEGAR_API_KEY` and `KAVENEGAR_VERIFY_TEMPLATE` (approved template name).
- `SMS_CREDENTIALS_ENCRYPTION_KEY`: base64-encoded 32-byte key used for salon credentials. Generate once, store as a deployment secret, back it up securely, and never rotate it without re-encrypting existing records.
- Missing/unknown provider: startup fails. A production process starts only with a complete Kavenegar configuration.
- OTP appears in the API response **only** if `NODE_ENV=development` **and** `SMS_PROVIDER=mock`; never in staging/production.
- Never commit API keys. Configure deployment secrets securely.

## After purchasing the panel

1. Create and approve a Verify Lookup template in Kavenegar. Confirm its token placeholder with the provider.
2. Set `SMS_PROVIDER=kavenegar`, `KAVENEGAR_API_KEY` and `KAVENEGAR_VERIFY_TEMPLATE` on a protected staging environment.
3. Restart the API; request OTP for a controlled test number and verify delivery, expiry, wrong code and rate limits.
4. Monitor provider errors without logging OTP, API key or full request URLs.
5. Confirm the exact Kavenegar endpoint and account permissions against the provider's current documentation before enabling production.

## Failure behavior

Delivery failures return 503; they must not be represented as successful sends. The generated OTP is marked used when delivery fails, while the rate-limit attempt remains counted to avoid provider-failure abuse. Production rollout remains blocked until an actual provider delivery test passes.
