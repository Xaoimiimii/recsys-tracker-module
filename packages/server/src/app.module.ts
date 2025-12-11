import { Module } from '@nestjs/common';
import { DomainModule } from './modules/domain/domain.module';
import { RuleModule } from './modules/rule/rule.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { EventModule } from './modules/event/event.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DomainModule,
    RuleModule,
    PrismaModule,
    EventModule
  ],
  controllers: [],
})
export class AppModule {}
