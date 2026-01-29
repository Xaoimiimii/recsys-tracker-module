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
import KeyvRedis from '@keyv/redis';
import { SearchKeywordConfigModule } from './modules/search-keyword-config/search-keyword-config.module';

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
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.getOrThrow('REDIS_HOST');
        const redisPort = configService.getOrThrow<number>('REDIS_PORT');
        const redisUsername = configService.get('REDIS_USERNAME') || 'default';
        const redisPassword = configService.getOrThrow('REDIS_PASSWORD');
        
        const redisUrl = `redis://${redisUsername}:${redisPassword}@${redisHost}:${redisPort}`;
        
        return {
          stores: [new KeyvRedis(redisUrl)],
          ttl: 30 * 60 * 1000 // 30 minutes in milliseconds
        };
      },
      inject: [ConfigService],
    }),
    SearchKeywordConfigModule
  ],
  controllers: [],
})
export class AppModule {}