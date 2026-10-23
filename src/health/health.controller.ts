import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check service health', description: 'Checks application dependencies such as PostgreSQL and Redis and returns their current health state.' })
  check() {
    return this.healthService.check();
  }
}
