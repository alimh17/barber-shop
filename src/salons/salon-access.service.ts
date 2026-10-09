
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

    const membership =
      await this.prisma.salonMembership.findFirst({
        where: {
          userId,
          salonId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this salon',
      );
    }
  }
}