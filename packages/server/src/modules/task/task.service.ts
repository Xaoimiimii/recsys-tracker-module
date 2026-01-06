import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecommendationService } from '../recommendation/recommendation.service';

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);
    constructor(private readonly recommendationService: RecommendationService) { }

    @Cron(CronExpression.EVERY_HOUR)
    trainModels() {
        this.recommendationService.triggerTrainModels();
        this.logger.debug('Trigger training models');
    }
}
