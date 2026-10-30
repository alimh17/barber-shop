import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

describe('OpenAPI document', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents all controllers and user-management routes', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').addBearerAuth().build(),
    );
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/users',
        '/users/{id}',
        '/users/{id}/status',
        '/auth/request-otp',
        '/appointments',
        '/availability',
        '/salons',
        '/barbers',
        '/services',
        '/health',
        '/reports/revenue',
        '/reports/revenue/export',
        '/notifications/configuration',
        '/notifications/subscriptions',
      ]),
    );
    expect(document.paths['/users']?.get?.summary).toBe('List users');
    expect(document.paths['/users/{id}/status']?.patch?.security).toBeDefined();
  });
});
