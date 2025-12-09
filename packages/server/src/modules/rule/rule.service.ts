import { Injectable } from '@nestjs/common';
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
            !rule.domainId ||
            !rule.triggerEventId ||
            !rule.targetEventPatternId ||
            !rule.targetOperatorId ||
            !rule.payloadConfigs ||
            rule.payloadConfigs.length === 0
        )
            return null;

        if (
            !(await this.prisma.domain.findUnique({
                where: {
                    Id: rule.domainId,
                },
            }))
        )
            return null;

        if (
            !(await this.prisma.triggerEvent.findUnique({
                where: {
                    Id: rule.triggerEventId,
                },
            }))
        )
            return null;

        const eventPatterns = await this.prisma.eventPattern.findMany();
        const operators = await this.prisma.operator.findMany();
        const payloadPatterns = await this.prisma.payloadPattern.findMany();

        for (const payloadConfig of rule.payloadConfigs) {
            if (
                !payloadPatterns.find(
                    (pp) => pp.Id === payloadConfig.payloadPatternId,
                )
            )
                return null;
            if (!operators.find((op) => op.Id === payloadConfig.operatorId))
                return null;
            if (!payloadConfig.value) return null;
        }

        for (const condition of rule.conditions) {
            if (!eventPatterns.find((ep) => ep.Id === condition.eventPatternId))
                return null;
            if (!operators.find((op) => op.Id === condition.operatorId))
                return null;
            if (!condition.value) return null;
        }

        if (!eventPatterns.find((ep) => ep.Id === rule.targetEventPatternId)) return null;
        if (!operators.find((op) => op.Id === rule.targetOperatorId)) return null;

        const targetElement = await this.prisma.targetElement.create({
            data: {
                Value: rule.targetElementValue,
                EventPatternID: rule.targetEventPatternId,
                OperatorID: rule.targetOperatorId,
            }
        });

        if (!targetElement) return null;

        const createdRule = await this.prisma.rule.create({
            data: {
                Name: rule.name,
                DomainID: rule.domainId,
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
            },
        });
        return rules;
    }
}
