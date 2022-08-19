import { Module } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { RootController } from './root.controller';

@Module({
  imports: [OnPatientModule],
  controllers: [RootController],
})
export class RootModule {}
