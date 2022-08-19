import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class RootController {
  @Get('/')
  getData() {
    return '🚀';
  }
}
