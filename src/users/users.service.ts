import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  Prisma,
  User,
  UserRole,
  UserStatus,
} from '../generated/prisma/client.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const publicUserSelect = {
  id: true,
  phone: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  salonMemberships: {
    where: { isActive: true },
    select: {
      salonId: true,
      isActive: true,
      salon: { select: { id: true, name: true, slug: true } },
    },
  },
  barber: { select: { id: true, salonId: true, isActive: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        phone,
      },
    });
  }

  async canBootstrapSalonSms(
    phone: string,
    salonSlug: string,
  ): Promise<boolean> {
    const admin = await this.prisma.user.findFirst({
      where: {
        phone,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        salonMemberships: {
          some: {
            isActive: true,
            salon: { slug: salonSlug, isActive: true, smsConfig: null },
          },
        },
      },
      select: { id: true },
    });
    return Boolean(admin);
  }

  async createCustomer(phone: string, salonSlug?: string): Promise<User> {
    if (!salonSlug)
      throw new BadRequestException('Salon invitation link is required');
    const salon = await this.prisma.salon.findFirst({
      where: { slug: salonSlug, isActive: true },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    return this.prisma.user.create({
      data: {
        phone,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        customer: { create: {} },
        salonMemberships: { create: { salonId: salon.id } },
      },
    });
  }

  async ensureCustomerSalon(userId: string, salonSlug?: string): Promise<void> {
    const membership = await this.prisma.salonMembership.findFirst({
      where: { userId, isActive: true },
      include: { salon: true },
    });
    if (membership) {
      if (!membership.salon.isActive)
        throw new ForbiddenException('Salon is inactive');
      if (salonSlug && membership.salon.slug !== salonSlug) {
        throw new ForbiddenException('Account belongs to another salon');
      }
      return;
    }
    if (!salonSlug)
      throw new BadRequestException('Salon invitation link is required');
    const salon = await this.prisma.salon.findFirst({
      where: { slug: salonSlug, isActive: true },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    const other = await this.prisma.salonMembership.findFirst({
      where: { userId },
    });
    if (other && other.salonId !== salon.id)
      throw new ConflictException('Account already belongs to another salon');
    await this.prisma.salonMembership.upsert({
      where: { userId_salonId: { userId, salonId: salon.id } },
      update: { isActive: true },
      create: { userId, salonId: salon.id },
    });
  }

  async updateRefreshToken(
    userId: string,
    refreshTokenHash: string | null,
  ): Promise<User> {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash,
      },
    });
  }

  /** Lists users visible to the caller with filters and offset pagination. */
  async findAll(actorId: string, actorRole: UserRole, query: ListUsersDto) {
    const scope = this.buildAccessScope(actorId, actorRole, query.salonId);
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      AND: [
        scope,
        query.role ? { role: query.role } : {},
        query.status ? { status: query.status } : {},
        search
          ? {
              OR: [
                { phone: { contains: search } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Returns a public user profile after enforcing tenant visibility. */
  async findOne(id: string, actorId: string, actorRole: UserRole) {
    if (id !== actorId && actorRole === UserRole.CUSTOMER)
      throw new ForbiddenException('You can only access your own profile');
    const user = await this.prisma.user.findFirst({
      where: { id, ...this.buildAccessScope(actorId, actorRole) },
      select: publicUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Updates profile fields for the owner or an authorized administrator. */
  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    actorRole: UserRole,
  ) {
    await this.findOne(id, actorId, actorRole);
    const birthDate = dto.birthDate
      ? new Date(`${dto.birthDate}T00:00:00.000Z`)
      : undefined;
    if (birthDate && birthDate.getTime() > Date.now()) {
      throw new BadRequestException('Birth date cannot be in the future');
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate,
      },
      select: publicUserSelect,
    });
  }

  /** Changes account status. Reserved for super administrators. */
  async updateStatus(id: string, status: UserStatus, actorId: string) {
    if (id === actorId)
      throw new ForbiddenException('You cannot change your own account status');
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: publicUserSelect,
    });
  }

  private buildAccessScope(
    actorId: string,
    actorRole: UserRole,
    salonId?: string,
  ): Prisma.UserWhereInput {
    if (actorRole === UserRole.SUPER_ADMIN)
      return salonId ? this.salonRelationScope(salonId) : {};
    if (actorRole === UserRole.ADMIN) {
      const salonScope: Prisma.UserWhereInput = {
        OR: [
          {
            salonMemberships: {
              some: {
                ...(salonId ? { salonId } : {}),
                isActive: true,
                salon: {
                  memberships: { some: { userId: actorId, isActive: true } },
                },
              },
            },
          },
          {
            barber: {
              is: {
                ...(salonId ? { salonId } : {}),
                salon: {
                  memberships: { some: { userId: actorId, isActive: true } },
                },
              },
            },
          },
        ],
      };
      return { OR: [{ id: actorId }, salonScope] };
    }
    return { id: actorId };
  }

  private salonRelationScope(salonId: string): Prisma.UserWhereInput {
    return {
      OR: [
        { salonMemberships: { some: { salonId, isActive: true } } },
        { barber: { is: { salonId } } },
      ],
    };
  }
}
