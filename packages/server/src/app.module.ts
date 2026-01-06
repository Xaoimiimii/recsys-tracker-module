import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { DomainModule } from './modules/domain/domain.module';
import { RuleModule } from './modules/rule/rule.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { EventModule } from './modules/event/event.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { TaskModule } from './modules/task/task.module';

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
    EventModule,
    RecommendationModule,
    TaskModule,
    ScheduleModule.forRoot(),   
  ],
  controllers: [],
})
export class AppModule {}