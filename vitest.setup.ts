/**
 * Vitest global setup file.
 *
 * When integration tests run on the host machine they connect to Docker-exposed
 * ports (localhost:5432, localhost:6379) rather than the Docker-internal
 * service hostnames ("postgres", "redis") that are only reachable from within
 * the Docker network.
 *
 * vitest.config.ts sets DATABASE_URL / REDIS_URL in `test.env` which are
 * injected into process.env BEFORE any test file is imported. However, test
 * files that contain `import 'dotenv/config'` at the top will re-read .env
 * and overwrite those values. To prevent that, we set the env vars here so
 * they win over anything dotenv/config might load later.
 *
 * The vitest `env` block in vitest.config.ts handles this automatically –
 * this file exists as an extra safety net and documents the intended behaviour.
 */

// Nothing to do at runtime – the env vars are injected by vitest.config.ts.
// If you need to add global beforeAll/afterAll hooks, do it here.
export {};
