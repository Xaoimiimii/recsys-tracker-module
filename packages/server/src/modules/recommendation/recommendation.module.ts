import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { HttpModule } from '@nestjs/axios';
import { RecommendationController } from './recommendation.controller';

@Module({
  imports: [HttpModule.register({
    timeout: 10000,
    maxRedirects: 5,
  })],
  providers: [RecommendationService],
  exports: [RecommendationService],
  controllers: [RecommendationController]
})
export class RecommendationModule { }