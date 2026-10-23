import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API welcome endpoint', description: 'Returns a basic response confirming that the HTTP application is running.' })
  getHello(): string {
    return this.appService.getHello();
  }
}
