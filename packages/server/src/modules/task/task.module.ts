import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [RecommendationModule],
  providers: [TaskService],
})
export class TaskModule { }
