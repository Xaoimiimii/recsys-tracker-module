import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
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
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '../sdk/dist'),
      serveRoot: '/dist',
    }),

    DomainModule,
    RuleModule,
    PrismaModule,
    EventModule
  ],
  controllers: [],
})
export class AppModule {}