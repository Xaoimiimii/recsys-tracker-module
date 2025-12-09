import { Module } from '@nestjs/common';
import { ReturnMethodController } from './return-method.controller';
import { ReturnMethodService } from './return-method.service';

@Module({
  controllers: [ReturnMethodController],
  providers: [ReturnMethodService]
})
export class ReturnMethodModule {}
