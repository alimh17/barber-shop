
import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SalonAccessService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async assertCanAccessSalon(
    userId: string,
    role: UserRole,
    salonId: string,
  ): Promise<void> {
    // Super admins can access every salon.
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    const [membership, barber] = await Promise.all([
      this.prisma.salonMembership.findFirst({
        where: { userId, salonId, isActive: true, salon: { isActive: true } },
        select: { id: true },
      }),
      role === UserRole.BARBER
        ? this.prisma.barber.findFirst({
            where: { userId, salonId, isActive: true, salon: { isActive: true } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (role === UserRole.BARBER ? !barber : !membership) {
      throw new ForbiddenException(
        'You do not have access to this salon',
      );
    }
  }
}