
import 'dotenv/config';

import { afterAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function createProbeTable(
  tx: Prisma.TransactionClient,
) {
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE "AppointmentOverlapProbe" (
      "barberId" TEXT NOT NULL,
      "startAt" TIMESTAMP(3) NOT NULL,
      "endAt" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL,
      CONSTRAINT "appointment_no_overlap"
      EXCLUDE USING gist (
        "barberId" gist_text_ops WITH =,
        tsrange("startAt", "endAt", '[)') WITH &&
      )
      WHERE ("status" IN ('PENDING', 'CONFIRMED'))
    ) ON COMMIT DROP
  `);
}

describe('PostgreSQL appointment overlap constraint', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects overlapping active appointments', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await createProbeTable(tx);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          VALUES (
            'barber-test',
            '2030-01-01 10:00',
            '2030-01-01 10:30',
            'PENDING'
          )
        `);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          VALUES (
            'barber-test',
            '2030-01-01 10:15',
            '2030-01-01 10:45',
            'CONFIRMED'
          )
        `);
      }),
    ).rejects.toThrow(/appointment_no_overlap/i);
  });

  it('allows adjacent appointments', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await createProbeTable(tx);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          VALUES (
            'barber-test',
            '2030-01-01 10:00',
            '2030-01-01 10:30',
            'CONFIRMED'
          )
        `);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          VALUES (
            'barber-test',
            '2030-01-01 10:30',
            '2030-01-01 11:00',
            'PENDING'
          )
        `);
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a new appointment over a cancelled appointment', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await createProbeTable(tx);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          VALUES (
            'barber-test',
            '2030-01-01 10:00',
            '2030-01-01 10:30',
            'CANCELLED'
          )
        `);

        await tx.$executeRawUnsafe(`
          INSERT INTO "AppointmentOverlapProbe"
          VALUES (
            'barber-test',
            '2030-01-01 10:00',
            '2030-01-01 10:30',
            'PENDING'
          )
        `);
      }),
    ).resolves.toBeUndefined();
  });
});