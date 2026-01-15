import { Module } from '@nestjs/common';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
import { ReturnMethodModule } from '../return-method/return-method.module';

@Module({
  controllers: [DomainController],
  providers: [DomainService],
  imports: [ReturnMethodModule]
})
export class DomainModule {}
