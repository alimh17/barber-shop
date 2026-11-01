import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { HttpErrorFilter } from './http-error.filter.js';

function setup(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ locals: { requestId: 'test-request' }, status }), getRequest: () => ({ method: 'POST' }) }) } as unknown as ArgumentsHost;
  new HttpErrorFilter().catch(exception, host);
  return { json, status };
}
describe('HTTP error correlation', () => {
  it('preserves validation error and adds a request ID', () => {
    const { json, status } = setup(new BadRequestException('Invalid input'));
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid input', requestId: 'test-request', statusCode: 400 }));
  });
  it('does not expose unexpected error details to clients', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const { json, status } = setup(new Error('private database password'));
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ message: 'Internal server error', statusCode: 500, requestId: 'test-request' });
      expect(spy.mock.calls.join(' ')).not.toContain('private database password');
    } finally { spy.mockRestore(); }
  });
});
