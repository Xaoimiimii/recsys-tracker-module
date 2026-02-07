import { Body, Controller, Post } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { ApiOperation } from '@nestjs/swagger';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Controller('evaluation')
export class EvaluationController {
    constructor(private readonly evaluationService: EvaluationService) { }
    
    @Post()
    @ApiOperation({ summary: "Create an evaluation" })
    async createEvaluation(@Body() body: CreateEvaluationDto) {
        return this.evaluationService.createEvaluation(
            body.DomainKey,
            body.Rank
        )
    }
}
