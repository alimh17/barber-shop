import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // Override DATABASE_URL and REDIS_URL so integration tests can connect to
    // the Docker-exposed ports on localhost (127.0.0.1:5432 / :6379) instead
    // of the Docker-internal service hostname "postgres" which is unreachable
    // from the host machine. These override whatever dotenv/config loads from .env.
    env: {
      DATABASE_URL: 'postgresql://barbershop:barbershop123@localhost:5432/barbershop?schema=public',
      REDIS_URL: 'redis://:redis123@localhost:6379/0',
      DOTENV_CONFIG_PATH: '.env.test',
    },
  },
});
