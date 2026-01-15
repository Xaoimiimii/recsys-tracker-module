import { Controller, Body, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationPushKeywordDto } from './dto/recommend-push-keyword.dto';

@Controller('recommendation')
export class RecommendationController {
    constructor(private readonly recommendationService: RecommendationService) { }

    @Post()
    async getRecommendations(@Body() body: RecommendationRequestDto) {
        const { UserId, AnonymousId, DomainKey, NumberItems } = body;

        return await this.recommendationService.getRecommendations(
            AnonymousId,
            DomainKey,
            NumberItems ?? 10,
            UserId,
        );
    }

    @Post('push-keyword')
    async pushRecommendationKeyword(@Body() body: RecommendationPushKeywordDto) {
        const { AnonymousId, DomainKey, Keyword, UserId } = body;
        return await this.recommendationService.pushRecommendationKeyword(
            AnonymousId,
            DomainKey,
            Keyword,
            UserId,
        );
    }
}
