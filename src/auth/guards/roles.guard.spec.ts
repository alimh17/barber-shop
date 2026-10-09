import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/client.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };

  let request: {
    user?: {
      id: string;
      role: UserRole;
    };
  };

  let handler: object;
  let controller: object;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };

    guard = new RolesGuard(
      reflector as unknown as Reflector,
    );

    request = {};
    handler = {};
    controller = {};
  });

  function createContext() {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(
      undefined,
    );

    expect(
      guard.canActivate(createContext()),
    ).toBe(true);
  });

  it('allows access when the required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(
      guard.canActivate(createContext()),
    ).toBe(true);
  });

  it('denies access when the request has no user', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(
      guard.canActivate(createContext()),
    ).toBe(false);
  });

  it('allows access when the user has the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ]);

    request.user = {
      id: 'user-1',
      role: UserRole.ADMIN,
    };

    expect(
      guard.canActivate(createContext()),
    ).toBe(true);
  });

  it('denies access when the user role is not permitted', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.SUPER_ADMIN,
    ]);

    request.user = {
      id: 'user-2',
      role: UserRole.BARBER,
    };

    expect(
      guard.canActivate(createContext()),
    ).toBe(false);
  });

  it('checks handler and controller role metadata', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
    ]);

    request.user = {
      id: 'user-3',
      role: UserRole.ADMIN,
    };

    guard.canActivate(createContext());

    expect(
      reflector.getAllAndOverride,
    ).toHaveBeenCalledWith(
      'roles',
      [handler, controller],
    );
  });
});
