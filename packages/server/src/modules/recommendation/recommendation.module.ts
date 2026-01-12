import { Module, Search } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { HttpModule } from '@nestjs/axios';
import { RecommendationController } from './recommendation.controller';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [HttpModule.register({
    timeout: 10000,
    maxRedirects: 5,
  }),
    SearchModule
  ],
  providers: [RecommendationService],
  exports: [RecommendationService],
  controllers: [RecommendationController]
})
export class RecommendationModule { }