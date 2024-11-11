import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@Controller('health')
export class AppController {
  @ApiTags('health')
  @ApiOkResponse({
    description: 'Returns 🚀 if the application is running',
    type: String,
  })
  @Get('/')
  getData() {
    return '🚀';
  }
}
