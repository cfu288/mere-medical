import { Module } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { RootController } from './root.controller';
import { StaticModule } from './static.module';

@Module({
  imports: [OnPatientModule, StaticModule],
  controllers: [RootController],
})
export class RootModule {}
