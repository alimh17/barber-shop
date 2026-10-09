import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '../../generated/prisma/client.js';
import { UsersService } from '../../users/users.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: {
    findById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    usersService = {
      findById: vi.fn(),
    };

    const configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return 'test-secret';
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    strategy = new JwtStrategy(
      configService as unknown as ConfigService,
      usersService as unknown as UsersService,
    );
  });

  it('returns safe user data for an active user', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      phone: '09120000000',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      password: 'should-not-be-returned',
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        phone: '09120000000',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      phone: '09120000000',
      role: UserRole.ADMIN,
    });

    expect(usersService.findById).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('rejects a user that does not exist', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'missing-user',
        phone: '09120000000',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an inactive user', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-2',
      phone: '09120000001',
      role: UserRole.CUSTOMER,
      status: UserStatus.INACTIVE,
    });

    await expect(
      strategy.validate({
        sub: 'user-2',
        phone: '09120000001',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a blocked user', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-3',
      phone: '09120000002',
      role: UserRole.CUSTOMER,
      status: UserStatus.BLOCKED,
    });

    await expect(
      strategy.validate({
        sub: 'user-3',
        phone: '09120000002',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
