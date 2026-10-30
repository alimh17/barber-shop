import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    seed: 'pnpm build && node --experimental-strip-types prisma/seed-load.ts',
  },

  datasource: {
    url: env('DATABASE_URL'),
  },
});
