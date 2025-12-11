import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';
import { RuleService } from './rule.service';
import { CreateRuleDto } from './dto';

@Controller('rule')
export class RuleController {
    constructor(private ruleService: RuleService) {}

    @Get('event-patterns')
    async getEventPatterns() {
        const eventPatterns = await this.ruleService.getEventPatterns();
        return eventPatterns;
    }

    @Get('payload-patterns')
    async getPayloadPatterns() {
        const payloadPatterns = await this.ruleService.getPayloadPatterns();
        return payloadPatterns;
    }

    @Get('operators')
    async getOperators() {
        const operators = await this.ruleService.getOperators();
        return operators;
    }

    @Post('create')
    async createRule(@Body() rule: CreateRuleDto) {
        const createdRule = await this.ruleService.createRule(rule);
        if (!createdRule) {
            throw new HttpException(
                { statusCode: 404, message: 'Some error occurred' },
                HttpStatus.NOT_FOUND,
            );
        }

        return {
            statusCode: HttpStatus.CREATED,
            message: 'Rule was created successfully',
        };
    }

    @Get(':id')
    async getRule(@Param('id', ParseIntPipe) id: number)
    {
        const rule = await this.ruleService.getRuleById(id);
        if (!rule) {
            throw new HttpException(
                { statusCode: 404, message: 'Rule not found' },
                HttpStatus.NOT_FOUND,
            );
        }
        return rule;
    }

    @Get('/domain/:key')
    async getRulesByDomainKey(@Param('key') key: string)
    {
        const rules = await this.ruleService.getRulesByDomainKey(key);
        if (!rules) {
            throw new HttpException(
                { statusCode: 404, message: 'No rules found for this domain' },
                HttpStatus.NOT_FOUND,
            );
        }

        const result = rules.map(r => ({ id: r.Id, name: r.Name, TriggerTypeName: r.TriggerEvent.Name }));
        return result;
    }
}
