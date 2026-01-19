import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class RuleService {
    constructor(private prisma: PrismaService) { }

    async getOperators() {
        const operators = await this.prisma.operator.findMany();
        return operators;
    }

    async createRule(rule: CreateRuleDto) {
        if (
            !rule.Name ||
            !rule.DomainKey ||
            !rule.EventTypeId
        )
            throw new BadRequestException('Missing required fields to create rule.');

        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: rule.DomainKey,
            },
        });

        if (!domain) throw new NotFoundException(`Domain key '${rule.DomainKey}' does not exist.`);

        if (
            !(await this.prisma.eventType.findUnique({
                where: {
                    Id: rule.EventTypeId,
                },
            }))
        )
            throw new NotFoundException(`Event type id '${rule.EventTypeId}' does not exist.`);


        const createdRule = await this.prisma.trackingRule.create({
            data: {
                Name: rule.Name,
                DomainID: domain.Id,
                EventTypeID: rule.EventTypeId,
                TrackingTarget: rule.TrackingTarget,
                ActionType: rule.ActionType,
            },
        });

        for (const payloadMapping of rule.PayloadMappings)
        {
            await this.prisma.payloadMapping.create({
                data: {
                    Field: payloadMapping.Field,
                    Source: payloadMapping.Source,
                    TrackingRuleId: createdRule.Id,
                    Config: payloadMapping.Config as Prisma.InputJsonValue
                }
            })
        }
        
        return createdRule;
    }

    async getRuleById(id: number) {
        const rule = await this.prisma.trackingRule.findUnique({
            where: {
                Id: id,
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

        const rules = await this.prisma.trackingRule.findMany({
            where: {
                DomainID: domain.Id,
            },
            include: {
                // EventType: true
                PayloadMappings: true
            },
        });
        return rules;
    }

    async getAllEventTypes() {
        const types = await this.prisma.eventType.findMany();
        return types;
    }
}
