import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush from 'web-push';

import { AppointmentStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto.js';

type NotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getPublicConfiguration() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')?.trim();
    return {
      configured: Boolean(this.vapidDetails()),
      publicKey: publicKey || undefined,
    };
  }

  async saveSubscription(userId: string, dto: SavePushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });
  }

  async removeSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { removed: true };
  }

  async notifyAppointmentCreated(appointmentId: string) {
    await this.safelyNotify(() =>
      this.notifyAppointment(appointmentId, {
        title: 'نوبت جدید ثبت شد',
        body: 'یک نوبت جدید در سالن ثبت شده است.',
        url: '/dashboard',
        tag: `appointment-created-${appointmentId}`,
      }),
    );
  }

  async notifyAppointmentStatusChanged(
    appointmentId: string,
    status: AppointmentStatus,
  ) {
    const labels: Record<AppointmentStatus, string> = {
      PENDING: 'در انتظار تأیید',
      CONFIRMED: 'تأیید شد',
      COMPLETED: 'تکمیل شد',
      CANCELLED: 'لغو شد',
      NO_SHOW: 'عدم مراجعه ثبت شد',
    };
    await this.safelyNotify(() =>
      this.notifyAppointment(appointmentId, {
        title: 'وضعیت نوبت تغییر کرد',
        body: `وضعیت نوبت: ${labels[status]}`,
        url: '/dashboard',
        tag: `appointment-status-${appointmentId}`,
      }),
    );
  }

  private async safelyNotify(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      this.logger.warn(
        `Push notification processing failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async notifyAppointment(
    appointmentId: string,
    payload: NotificationPayload,
  ) {
    if (!this.vapidDetails()) return;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        customer: { select: { userId: true } },
        barber: { select: { userId: true } },
        salon: {
          select: {
            memberships: {
              where: { isActive: true },
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!appointment) return;
    const userIds = [
      appointment.customer.userId,
      appointment.barber.userId,
      ...appointment.salon.memberships.map((membership) => membership.userId),
    ];
    await this.sendToUsers([...new Set(userIds)], payload);
  }

  private async sendToUsers(userIds: string[], payload: NotificationPayload) {
    const vapidDetails = this.vapidDetails();
    if (!vapidDetails || userIds.length === 0) return;
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(payload),
            { TTL: 60 * 60, urgency: 'high', vapidDetails },
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({
              where: { id: subscription.id },
            });
            return;
          }
          this.logger.warn(
            `Push delivery failed with status ${statusCode ?? 'unknown'}`,
          );
        }
      }),
    );
  }

  private vapidDetails() {
    const subject = this.config.get<string>('VAPID_SUBJECT')?.trim();
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')?.trim();
    return subject && publicKey && privateKey
      ? { subject, publicKey, privateKey }
      : null;
  }
}
