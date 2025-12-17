import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto';

@Injectable()
export class RuleService {
    constructor(private prisma: PrismaService) {}

    async getEventPatterns() {
        const eventPatterns = await this.prisma.eventPattern.findMany();
        return eventPatterns;
    }

    async getPayloadPatterns() {
        const payloadPatterns = await this.prisma.payloadPattern.findMany();
        return payloadPatterns;
    }

    async getOperators() {
        const operators = await this.prisma.operator.findMany();
        return operators;
    }

    async createRule(rule: CreateRuleDto) {
        if (
            !rule.name ||
            !rule.domainKey ||
            !rule.triggerEventId ||
            !rule.targetEventPatternId ||
            !rule.targetOperatorId ||
            !rule.payloadConfigs ||
            rule.payloadConfigs.length === 0
        )
            throw new BadRequestException('Missing required fields to create rule.');

        if (
            !(await this.prisma.triggerEvent.findUnique({
                where: {
                    Id: rule.triggerEventId,
                },
            }))
        )
            throw new NotFoundException(`Trigger event id '${rule.triggerEventId}' does not exist.`);

        const eventPatterns = await this.prisma.eventPattern.findMany();
        const operators = await this.prisma.operator.findMany();
        const payloadPatterns = await this.prisma.payloadPattern.findMany();

        for (const payloadConfig of rule.payloadConfigs) {
            if (
                !payloadPatterns.find(
                    (pp) => pp.Id === payloadConfig.payloadPatternId,
                )
            )
                throw new NotFoundException(`Payload pattern id '${payloadConfig.payloadPatternId}' does not exist.`);
            if (!operators.find((op) => op.Id === payloadConfig.operatorId))
                throw new NotFoundException(`Operator id '${payloadConfig.operatorId}' does not exist.`);
            if (!payloadConfig.value) throw new BadRequestException('Payload config value is required.');
        }

        for (const condition of rule.conditions) {
            if (!eventPatterns.find((ep) => ep.Id === condition.eventPatternId))
                throw new NotFoundException(`Event pattern id '${condition.eventPatternId}' does not exist.`);
            if (!operators.find((op) => op.Id === condition.operatorId))
                throw new NotFoundException(`Operator id '${condition.operatorId}' does not exist.`);
            if (!condition.value) throw new BadRequestException('Condition value is required.');
        }

        if (!eventPatterns.find((ep) => ep.Id === rule.targetEventPatternId)) throw new NotFoundException(`Event pattern id '${rule.targetEventPatternId}' does not exist.`);
        if (!operators.find((op) => op.Id === rule.targetOperatorId)) throw new NotFoundException(`Operator id '${rule.targetOperatorId}' does not exist.`);
        const targetElement = await this.prisma.targetElement.create({
            data: {
                Value: rule.targetElementValue,
                EventPatternID: rule.targetEventPatternId,
                OperatorID: rule.targetOperatorId,
            }
        });

        if (!targetElement) throw new BadRequestException('Error creating target element for the rule.');
        
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: rule.domainKey,
            },
        });

        if (!domain) throw new NotFoundException(`Domain key '${rule.domainKey}' does not exist.`);

        const createdRule = await this.prisma.rule.create({
            data: {
                Name: rule.name,
                DomainID: domain.Id,
                TriggerEventID: rule.triggerEventId,
                TargetElementID: targetElement.Id,
                PayloadConfigs: {
                    create: rule.payloadConfigs.map((pc) => ({
                        PayloadPatternID: pc.payloadPatternId,
                        OperatorID: pc.operatorId,
                        Value: pc.value,
                        Type: pc.type,
                    })),
                },
                Conditions: {
                    create: rule.conditions.map((c) => ({
                        EventPatternID: c.eventPatternId,
                        OperatorID: c.operatorId,
                        Value: c.value,
                    })),
                },
            },
            include: {
                PayloadConfigs: true,
                Conditions: true,
            },
        });

        return createdRule;
    }

    async getRuleById(id: number) {
        const rule = await this.prisma.rule.findUnique({
            where: {
                Id: id,
            },
            include: {
                PayloadConfigs: true,
                Conditions: true,
                TargetElement: true,
            },
        });
        return rule;
    }

    async getRulesByDomainKey(domainKey: string) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: domainKey,
            },
        });
        if (!domain) return null;

        const rules = await this.prisma.rule.findMany({
            where: {
                DomainID: domain.Id,
            },
            include: {
                PayloadConfigs: true,
                Conditions: true,
                TargetElement: true,
                TriggerEvent: true
            },
        });
        return rules;
    }
}
