import webPush from 'web-push';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus } from '../generated/prisma/client.js';
import { NotificationsService } from './notifications.service.js';

vi.mock('web-push', () => ({
  default: { sendNotification: vi.fn() },
}));

describe('NotificationsService', () => {
  const prisma = {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    appointment: { findUnique: vi.fn() },
  };
  const values: Record<string, string | undefined> = {};
  const config = { get: vi.fn((key: string) => values[key]) };
  let service: NotificationsService;

  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(values).forEach((key) => delete values[key]);
    service = new NotificationsService(prisma as never, config as never);
    prisma.pushSubscription.upsert.mockResolvedValue({ id: 'subscription-1' });
    prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    prisma.pushSubscription.findMany.mockResolvedValue([]);
  });

  it('exposes only the public VAPID key when fully configured', () => {
    values.VAPID_SUBJECT = 'mailto:admin@example.com';
    values.VAPID_PUBLIC_KEY = 'public-key';
    values.VAPID_PRIVATE_KEY = 'private-key';

    expect(service.getPublicConfiguration()).toEqual({
      configured: true,
      publicKey: 'public-key',
    });
    expect(JSON.stringify(service.getPublicConfiguration())).not.toContain(
      'private-key',
    );
  });

  it('upserts a browser subscription for the authenticated user', async () => {
    await service.saveSubscription('user-1', {
      endpoint: 'https://push.example/subscription',
      keys: { p256dh: 'p256dh-key-value-long', auth: 'auth-key-value' },
      userAgent: 'test-browser',
    });

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: 'https://push.example/subscription' },
        create: expect.objectContaining({ userId: 'user-1' }),
        update: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('sends appointment status notifications to unique related users', async () => {
    values.VAPID_SUBJECT = 'mailto:admin@example.com';
    values.VAPID_PUBLIC_KEY = 'public-key';
    values.VAPID_PRIVATE_KEY = 'private-key';
    prisma.appointment.findUnique.mockResolvedValue({
      customer: { userId: 'customer-1' },
      barber: { userId: 'barber-1' },
      salon: {
        memberships: [{ userId: 'admin-1' }, { userId: 'barber-1' }],
      },
    });
    prisma.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'subscription-1',
        endpoint: 'https://push.example/one',
        p256dh: 'p256dh',
        auth: 'auth',
      },
    ]);
    vi.mocked(webPush.sendNotification).mockResolvedValue({} as never);

    await service.notifyAppointmentStatusChanged(
      'appointment-1',
      AppointmentStatus.CONFIRMED,
    );

    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ['customer-1', 'barber-1', 'admin-1'] },
      },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/one' }),
      expect.stringContaining('تأیید شد'),
      expect.objectContaining({
        vapidDetails: expect.objectContaining({ privateKey: 'private-key' }),
      }),
    );
  });
});
