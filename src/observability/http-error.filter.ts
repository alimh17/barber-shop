import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = String(response.locals.requestId ?? 'unknown');
    if (status >= 500) {
      // Avoid serializing the exception object: it may contain database credentials or PII.
      const kind = exception instanceof Error ? exception.name : 'UnknownError';
      process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'unhandled_http_error', requestId, method: request.method, status, kind }) + '\n');
    }
    const body = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };
    const safeBody = typeof body === 'string' ? { message: body } : body;
    response.status(status).json({ ...(typeof safeBody === 'object' && safeBody !== null ? safeBody : {}), statusCode: status, requestId });
  }
}
