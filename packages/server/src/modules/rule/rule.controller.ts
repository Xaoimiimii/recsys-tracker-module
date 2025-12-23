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
import { ApiOperation } from '@nestjs/swagger';

@Controller('rule')
export class RuleController {
    constructor(private ruleService: RuleService) { }

    @Get('pattern')
    @ApiOperation({ summary: 'Get all patterns (CSS, ...)' })
    async getPatterns() {
        const patterns = await this.ruleService.getPatterns();
        return patterns;
    }

    @Get('operators')
    @ApiOperation({ summary: 'Get all operators (Contains, Equals, ...)' })
    async getOperators() {
        const operators = await this.ruleService.getOperators();
        return operators;
    }

    @Get('/event-type')
    @ApiOperation({ summary: 'Get all event types (Click, Rate, ...)' })
    async getAllEventTypes() {
        return this.ruleService.getAllEventTypes();
    }

    @Post('create')
    @ApiOperation({ summary: 'Create a new rule for a domain' })
    async createRule(@Body() rule: CreateRuleDto) {
        const createdRule = await this.ruleService.createRule(rule);

        return {
            statusCode: HttpStatus.CREATED,
            message: 'Rule was created successfully',
            ruleId: createdRule?.Id,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a rule by id' })
    async getRule(@Param('id', ParseIntPipe) id: number) {
        const rule = await this.ruleService.getRuleById(id);
        if (!rule) {
            throw new NotFoundException(`Rule id '${id}' does not exist.`);
        }
        return rule;
    }

    @Get('/domain/:key')
    @ApiOperation({ summary: 'Get all rules for a domain by key' })
    async getRulesByDomainKey(@Param('key') key: string) {
        const rules = await this.ruleService.getRulesByDomainKey(key);
        if (!rules) {
            throw new NotFoundException(`No rules found for domain key '${key}'.`);
        }

        const result = rules.map(r => ({ id: r.Id, name: r.Name, EventTypeName: r.EventType.Name }));
        return result;
    }
}
