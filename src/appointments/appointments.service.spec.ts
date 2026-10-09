
import { describe, expect, it } from 'vitest';

import { AppointmentsService } from './appointments.service.js';

describe('AppointmentsService constraint error detection', () => {
  const service = new AppointmentsService(
    {} as never,
    {} as never,
  );

  const hasOverlapConstraint = (error: unknown) =>
    (
      service as unknown as {
        isAppointmentOverlapConstraintError(
          error: unknown,
        ): boolean;
      }
    ).isAppointmentOverlapConstraintError(error);

  it('detects the actual Prisma 7 + PrismaPg error shape', () => {
    const error = {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            code: '23P01',
            message:
              'conflicting key value violates exclusion constraint "appointment_no_overlap"',
            originalMessage:
              'conflicting key value violates exclusion constraint "appointment_no_overlap"',
          },
        },
      },
    };

    expect(hasOverlapConstraint(error)).toBe(true);
  });

  it('does not match a different exclusion constraint', () => {
    const error = {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            code: '23P01',
            message:
              'conflicting key value violates exclusion constraint "another_constraint"',
          },
        },
      },
    };

    expect(hasOverlapConstraint(error)).toBe(false);
  });

  it('does not match the diagnostic probe constraint', () => {
    const error = {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            message:
              'conflicting key value violates exclusion constraint "appointment_no_overlap_probe"',
          },
        },
      },
    };

    expect(hasOverlapConstraint(error)).toBe(false);
  });

  it('returns false for unrelated errors', () => {
    expect(
      hasOverlapConstraint(new Error('Database unavailable')),
    ).toBe(false);
  });
});