import { Module } from '@nestjs/common';
import { DomainModule } from './modules/domain/domain.module';
import { RuleModule } from './modules/rule/rule.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DomainModule,
    RuleModule,
    PrismaModule
  ],
  controllers: [],
})
export class AppModule {}
