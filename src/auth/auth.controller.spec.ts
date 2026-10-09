import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OtpRateLimitGuard } from './guards/otp-rate-limit.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
    UserRole,
    UserStatus,
} from '../generated/prisma/client.js';

describe('AuthController (HTTP)', () => {
    let app: INestApplication;
    let jwtService: JwtService;

    const secret = 'test-jwt-secret';

    const usersService = {
        findById: vi.fn(),
    };

    const authService = {
        logout: vi.fn(),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                PassportModule.register({
                    defaultStrategy: 'jwt',
                }),
                JwtModule.register({
                    secret,
                    signOptions: {
                        expiresIn: '5m',
                    },
                }),
            ],
            controllers: [AuthController],
            providers: [
                JwtAuthGuard,
                { provide: PrismaService, useValue: {} },
                { provide: OtpRateLimitGuard, useValue: { canActivate: () => true } },
                JwtStrategy,
                {
                    provide: AuthService,
                    useValue: authService,
                },
                {
                    provide: UsersService,
                    useValue: usersService,
                },
                {
                    provide: ConfigService,
                    useValue: {
                        getOrThrow: (key: string) => {
                            if (key === 'JWT_ACCESS_SECRET') {
                                return secret;
                            }

                            throw new Error(
                                `Unexpected config key: ${key}`,
                            );
                        },
                    },
                },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        jwtService = moduleRef.get(JwtService);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when the token is missing', async () => {
        await request(app.getHttpServer())
            .get('/auth/me')
            .expect(401);
    });

    it('returns 401 when the token is invalid', async () => {
        await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', 'Bearer invalid-token')
            .expect(401);
    });

    it('returns 401 when the token is expired', async () => {
        const token = jwtService.sign(
            {
                sub: 'user-1',
                phone: '09120000000',
                role: UserRole.CUSTOMER,
            },
            {
                secret,
                expiresIn: -1,
            },
        );

        await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(401);
    });

    it('returns the authenticated user for a valid token', async () => {
        usersService.findById.mockResolvedValue({
            id: 'user-1',
            phone: '09120000000',
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
        });

        const token = jwtService.sign(
            {
                sub: 'user-1',
                phone: '09120000000',
                role: UserRole.CUSTOMER,
            },
            {
                secret,
                expiresIn: '5m',
            },
        );

        const response = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: 'user-1',
            phone: '09120000000',
            role: UserRole.CUSTOMER,
        });

        expect(usersService.findById).toHaveBeenCalledWith(
            'user-1',
        );
    });
});
