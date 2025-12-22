import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';
import { RuleService } from './rule.service';
import { CreateRuleDto } from './dto';

@Controller('rule')
export class RuleController {
    constructor(private ruleService: RuleService) { }

    @Get('pattern')
    async getPatterns() {
        const patterns = await this.ruleService.getPatterns();
        return patterns;
    }

    // @Get('payload-patterns')
    // async getPayloadPatterns() {
    //     const payloadPatterns = await this.ruleService.getPayloadPatterns();
    //     return payloadPatterns;
    // }

    @Get('operators')
    async getOperators() {
        const operators = await this.ruleService.getOperators();
        return operators;
    }

    @Post('create')
    async createRule(@Body() rule: CreateRuleDto) {
        const createdRule = await this.ruleService.createRule(rule);

        return {
            statusCode: HttpStatus.CREATED,
            message: 'Rule was created successfully',
            ruleId: createdRule?.Id,
        };
    }

    @Get(':id')
    async getRule(@Param('id', ParseIntPipe) id: number) {
        const rule = await this.ruleService.getRuleById(id);
        if (!rule) {
            throw new NotFoundException(`Rule id '${id}' does not exist.`);
        }
        return rule;
    }

    @Get('/domain/:key')
    async getRulesByDomainKey(@Param('key') key: string) {
        const rules = await this.ruleService.getRulesByDomainKey(key);
        if (!rules) {
            throw new NotFoundException(`No rules found for domain key '${key}'.`);
        }

        const result = rules.map(r => ({ id: r.Id, name: r.Name, EventTypeName: r.EventType.Name }));
        return result;
    }
}
