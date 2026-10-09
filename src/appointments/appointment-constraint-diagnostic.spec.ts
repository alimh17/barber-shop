import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

describe('PostgreSQL appointment constraint diagnostic', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reveals the actual error shape for an exclusion violation', async () => {
    let caughtError: unknown;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          CREATE TEMP TABLE "AppointmentOverlapProbe" (
            "barberId" TEXT NOT NULL,
            "startAt" TIMESTAMP(3) NOT NULL,
            "endAt" TIMESTAMP(3) NOT NULL,
            "status" TEXT NOT NULL,
            CONSTRAINT "appointment_no_overlap_probe"
            EXCLUDE USING gist (
              "barberId" gist_text_ops WITH =,
              tsrange("startAt", "endAt", '[)') WITH &&
            )
            WHERE ("status" IN ('PENDING', 'CONFIRMED'))
          )
        `);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          ("barberId", "startAt", "endAt", "status")
          VALUES ('barber-test', '2030-01-01 10:00', '2030-01-01 10:30', 'PENDING')
        `);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          ("barberId", "startAt", "endAt", "status")
          VALUES ('barber-test', '2030-01-01 10:15', '2030-01-01 10:45', 'PENDING')
        `);
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeDefined();
  });
});
