import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { DomainModule } from './modules/domain/domain.module';
import { RuleModule } from './modules/rule/rule.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventModule } from './modules/event/event.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { TaskModule } from './modules/task/task.module';
import { SearchModule } from './modules/search/search.module';
import { ElasticConfigModule } from './common/elastic/elastic-config.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

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
    SearchModule,
    ElasticConfigModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.getOrThrow('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT')
          },
          username: configService.getOrThrow('REDIS_USERNAME'),
          password: configService.getOrThrow('REDIS_PASSWORD')
        })
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [],
})
export class AppModule {}