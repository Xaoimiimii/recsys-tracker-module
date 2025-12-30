import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendation')
export class RecommendationController {
    constructor(private readonly recommendationService: RecommendationService) { }

    @Get()
    getRecommendations(@Query('userId', ParseIntPipe) userId: number, @Query('numberItems', ParseIntPipe) numberItems: number = 10) {
        return this.recommendationService.getRecommendations(userId, numberItems);
    }
}
