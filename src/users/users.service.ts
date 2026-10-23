import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, User, UserRole, UserStatus } from '../generated/prisma/client.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const publicUserSelect = {
  id: true, phone: true, firstName: true, lastName: true, role: true, status: true,
  createdAt: true, updatedAt: true,
  salonMemberships: {
    where: { isActive: true },
    select: { salonId: true, isActive: true, salon: { select: { id: true, name: true, slug: true } } },
  },
  barber: { select: { id: true, salonId: true, isActive: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

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

  async createCustomer(phone: string): Promise<User> {
    return this.prisma.user.create({
      data: {
        phone,
        role: 'CUSTOMER',
        status: 'ACTIVE',

        customer: {
          create: {},
        },
      },
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
        search ? { OR: [
          { phone: { contains: search } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ] } : {},
      ],
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: publicUserSelect, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Returns a public user profile after enforcing tenant visibility. */
  async findOne(id: string, actorId: string, actorRole: UserRole) {
    if (id !== actorId && actorRole === UserRole.CUSTOMER) throw new ForbiddenException('You can only access your own profile');
    const user = await this.prisma.user.findFirst({ where: { id, ...this.buildAccessScope(actorId, actorRole) }, select: publicUserSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Updates profile fields for the owner or an authorized administrator. */
  async update(id: string, dto: UpdateUserDto, actorId: string, actorRole: UserRole) {
    await this.findOne(id, actorId, actorRole);
    return this.prisma.user.update({ where: { id }, data: dto, select: publicUserSelect });
  }

  /** Changes account status. Reserved for super administrators. */
  async updateStatus(id: string, status: UserStatus, actorId: string) {
    if (id === actorId) throw new ForbiddenException('You cannot change your own account status');
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { status }, select: publicUserSelect });
  }

  private buildAccessScope(actorId: string, actorRole: UserRole, salonId?: string): Prisma.UserWhereInput {
    if (actorRole === UserRole.SUPER_ADMIN) return salonId ? this.salonRelationScope(salonId) : {};
    if (actorRole === UserRole.ADMIN) {
      const salonScope: Prisma.UserWhereInput = { OR: [
        { salonMemberships: { some: { salonId: salonId, isActive: true, salon: { memberships: { some: { userId: actorId, isActive: true } } } } } },
        { barber: { is: { ...(salonId ? { salonId } : {}), salon: { memberships: { some: { userId: actorId, isActive: true } } } } } },
      ] };
      return { OR: [{ id: actorId }, salonScope] };
    }
    return { id: actorId };
  }

  private salonRelationScope(salonId: string): Prisma.UserWhereInput {
    return { OR: [
      { salonMemberships: { some: { salonId, isActive: true } } },
      { barber: { is: { salonId } } },
    ] };
  }
}
