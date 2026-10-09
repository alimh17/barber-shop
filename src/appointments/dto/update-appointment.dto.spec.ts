import { validate } from 'class-validator';

import { UpdateAppointmentDto } from './update-appointment.dto.js';

describe('UpdateAppointmentDto', () => {
  it('accepts ISO timestamps with an explicit UTC timezone', async () => {
    const dto = Object.assign(new UpdateAppointmentDto(), {
      startAt: '2099-01-01T11:00:00.000Z',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts ISO timestamps with an explicit timezone offset', async () => {
    const dto = Object.assign(new UpdateAppointmentDto(), {
      startAt: '2099-01-01T11:00:00+03:30',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects timezone-less timestamps', async () => {
    const dto = Object.assign(new UpdateAppointmentDto(), {
      startAt: '2099-01-01T11:00:00',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'startAt')).toBe(true);
  });
});
