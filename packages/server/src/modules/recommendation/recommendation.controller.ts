import { Controller, Body, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';

@Controller('recommendation')
export class RecommendationController {
    constructor(private readonly recommendationService: RecommendationService) { }

    @Post()
    getRecommendations(@Body() body: RecommendationRequestDto) {
    const { UserValue, UserField, DomainKey, NumberItems } = body;

    return this.recommendationService.getRecommendations(
        UserValue,
        UserField,
        DomainKey,
        NumberItems ?? 10,
    );
    }
}
