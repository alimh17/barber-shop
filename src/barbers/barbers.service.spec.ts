import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    UserRole,
    UserStatus,
} from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';

import { BarbersService } from './barbers.service.js';

describe('BarbersService', () => {
    let service: BarbersService;

    const prisma = {
        salon: {
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        barber: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    };

    const salonAccessService = {
        assertCanAccessSalon: vi.fn(),
    };

    const mockSalon = {
        id: 'salon-1',
        name: 'Test Salon',
        isActive: true,
    };

    const mockUser = {
        id: 'user-1',
        phone: '09120000000',
        firstName: 'Ali',
        lastName: 'Ahmadi',
        role: UserRole.BARBER,
        status: UserStatus.ACTIVE,
    };

    const mockBarber = {
        id: 'barber-1',
        userId: 'user-1',
        salonId: 'salon-1',
        isActive: true,
        user: mockUser,
        salon: mockSalon,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        service = new BarbersService(
            prisma as unknown as PrismaService,
            salonAccessService as unknown as SalonAccessService,
        );
    });

    describe('create', () => {
        const dto = {
            salonId: 'salon-1',
            phone: '09120000000',
            firstName: 'Ali',
            lastName: 'Ahmadi',
        };

        it('creates a barber for an active salon', async () => {
            prisma.salon.findUnique.mockResolvedValue(mockSalon);
            prisma.user.findUnique.mockResolvedValue(null);

            const tx = {
                user: {
                    create: vi.fn().mockResolvedValue(mockUser),
                },
                barber: {
                    create: vi.fn().mockResolvedValue(mockBarber),
                },
            };

            prisma.$transaction.mockImplementation(
                (callback: (transaction: typeof tx) => unknown) =>
                    callback(tx),
            );

            await expect(
                service.create(dto, 'admin-1', UserRole.ADMIN),
            ).resolves.toEqual(mockBarber);

            expect(
                salonAccessService.assertCanAccessSalon,
            ).toHaveBeenCalledWith(
                'admin-1',
                UserRole.ADMIN,
                'salon-1',
            );

            expect(tx.user.create).toHaveBeenCalledWith({
                data: {
                    phone: dto.phone,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    role: UserRole.BARBER,
                    status: UserStatus.ACTIVE,
                },
            });

            expect(tx.barber.create).toHaveBeenCalledWith({
                data: {
                    userId: mockUser.id,
                    salonId: dto.salonId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            role: true,
                            status: true,
                        },
                    },
                    salon: true,
                },
            });
        });

        it('throws NotFoundException when salon does not exist', async () => {
            prisma.salon.findUnique.mockResolvedValue(null);

            await expect(
                service.create(dto, 'admin-1', UserRole.ADMIN),
            ).rejects.toThrow(NotFoundException);

            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('rejects creating a barber for an inactive salon', async () => {
            prisma.salon.findUnique.mockResolvedValue({
                ...mockSalon,
                isActive: false,
            });

            await expect(
                service.create(dto, 'admin-1', UserRole.ADMIN),
            ).rejects.toThrow(ConflictException);

            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('rejects an existing phone number', async () => {
            prisma.salon.findUnique.mockResolvedValue(mockSalon);
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(
                service.create(dto, 'admin-1', UserRole.ADMIN),
            ).rejects.toThrow(
                'A user with this phone already exists',
            );

            expect(prisma.$transaction).not.toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('requires salonId for a regular admin', async () => {
            await expect(
                service.findAll('admin-1', UserRole.ADMIN),
            ).rejects.toThrow(BadRequestException);

            expect(prisma.barber.findMany).not.toHaveBeenCalled();
        });

        it('checks access and filters by salonId', async () => {
            prisma.barber.findMany.mockResolvedValue([mockBarber]);

            await expect(
                service.findAll(
                    'admin-1',
                    UserRole.ADMIN,
                    'salon-1',
                ),
            ).resolves.toEqual([mockBarber]);

            expect(
                salonAccessService.assertCanAccessSalon,
            ).toHaveBeenCalledWith(
                'admin-1',
                UserRole.ADMIN,
                'salon-1',
            );

            expect(prisma.barber.findMany).toHaveBeenCalledWith({
                where: {
                    salonId: 'salon-1',
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            role: true,
                            status: true,
                        },
                    },
                    salon: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        });

        it('allows SUPER_ADMIN to list barbers across all salons', async () => {
            prisma.barber.findMany.mockResolvedValue([mockBarber]);

            await expect(
                service.findAll(
                    'super-admin-1',
                    UserRole.SUPER_ADMIN,
                ),
            ).resolves.toEqual([mockBarber]);

            expect(prisma.barber.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                }),
            );

            expect(
                salonAccessService.assertCanAccessSalon,
            ).not.toHaveBeenCalled();
        });
    });

    describe('findById', () => {
        it('returns a barber after checking salon access', async () => {
            prisma.barber.findUnique.mockResolvedValue(mockBarber);

            await expect(
                service.findById(
                    'barber-1',
                    'admin-1',
                    UserRole.ADMIN,
                ),
            ).resolves.toEqual(mockBarber);

            expect(
                salonAccessService.assertCanAccessSalon,
            ).toHaveBeenCalledWith(
                'admin-1',
                UserRole.ADMIN,
                'salon-1',
            );
        });

        it('throws NotFoundException when barber does not exist', async () => {
            prisma.barber.findUnique.mockResolvedValue(null);

            await expect(
                service.findById(
                    'missing-barber',
                    'admin-1',
                    UserRole.ADMIN,
                ),
            ).rejects.toThrow(NotFoundException);

            expect(
                salonAccessService.assertCanAccessSalon,
            ).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('updates barber and user data in a transaction', async () => {
            prisma.barber.findUnique.mockResolvedValue(mockBarber);

            const tx = {
                user: {
                    update: vi.fn().mockResolvedValue({
                        ...mockUser,
                        firstName: 'Reza',
                    }),
                },
                barber: {
                    update: vi.fn().mockResolvedValue({
                        ...mockBarber,
                        user: {
                            ...mockUser,
                            firstName: 'Reza',
                        },
                    }),
                },
            };

            prisma.$transaction.mockImplementation(
                (callback: (transaction: typeof tx) => unknown) =>
                    callback(tx),
            );

            const dto = {
                firstName: 'Reza',
                isActive: false,
            };

            await expect(
                service.update(
                    'barber-1',
                    dto,
                    'admin-1',
                    UserRole.ADMIN,
                ),
            ).resolves.toEqual({
                ...mockBarber,
                user: {
                    ...mockUser,
                    firstName: 'Reza',
                },
            });

            expect(tx.user.update).toHaveBeenCalledWith({
                where: {
                    id: 'user-1',
                },
                data: {
                    firstName: 'Reza',
                },
            });

            expect(tx.barber.update).toHaveBeenCalledWith({
                where: {
                    id: 'barber-1',
                },
                data: {
                    isActive: false,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            role: true,
                            status: true,
                        },
                    },
                    salon: true,
                },
            });
        });

        it('rejects updating to a phone number already in use', async () => {
            prisma.barber.findUnique.mockResolvedValue(mockBarber);
            prisma.user.findUnique.mockResolvedValue({
                ...mockUser,
                id: 'another-user',
                phone: '09121111111',
            });

            await expect(
                service.update(
                    'barber-1',
                    { phone: '09121111111' },
                    'admin-1',
                    UserRole.ADMIN,
                ),
            ).rejects.toThrow(ConflictException);

            expect(prisma.$transaction).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('soft-deactivates a barber instead of deleting it', async () => {
            prisma.barber.findUnique.mockResolvedValue(mockBarber);
            prisma.barber.update.mockResolvedValue({
                ...mockBarber,
                isActive: false,
            });

            await expect(
                service.remove(
                    'barber-1',
                    'admin-1',
                    UserRole.ADMIN,
                ),
            ).resolves.toEqual({
                ...mockBarber,
                isActive: false,
            });

            expect(prisma.barber.update).toHaveBeenCalledWith({
                where: {
                    id: 'barber-1',
                },
                data: {
                    isActive: false,
                },
            });
        });
    });
});
