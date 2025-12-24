import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UserField, ItemField } from 'src/common/enums/event.enum';
import { User } from 'src/generated/prisma/client';

@Injectable()
export class EventService {
    constructor(private prisma: PrismaService) { }

    async addEvent(event: CreateEventDto) {
        if (!(await this.prisma.eventType.findUnique({
            where: {
                Id: event.EventTypeId,
            }
        }))) throw new NotFoundException(`Event type id '${event.EventTypeId}' does not exist.`);

        const trackingRule = await this.prisma.trackingRule.findUnique({
            where: {
                Id: event.TrackingRuleId,
            }
        })

        if (!trackingRule) throw new NotFoundException(`Tracking rule id '${event.TrackingRuleId}' does not exist.`);

        const domain = await this.prisma.domain.findUnique({
            where: {
                Id: trackingRule.DomainID,
            }
        })

        if (!domain) throw new NotFoundException(`Domain ID '${trackingRule.DomainID}' does not exist.`);

        let user = await this.prisma.user.findUnique({
            where:
                event.UserField === UserField.USERNAME
                    ? { Username_DomainId: { Username: event.UserValue, DomainId: domain.Id } }
                    : { Id: parseInt(event.UserValue) }
        });

        if (!user) {
            user = await this.prisma.user.create({
                data:
                    event.UserField === UserField.USERNAME
                        ? { Username: event.UserValue, DomainId: domain.Id, CreatedAt: new Date() }
                        : { Id: parseInt(event.UserValue), DomainId: domain.Id, CreatedAt: new Date() }
            });
        }

        let targetItemIds: number[] = [];
        if (event.ItemField === ItemField.ITEM_ID) {
            const item = await this.prisma.item.findUnique({
                where: {
                    Id: parseInt(event.ItemValue),
                }
            })
            if (!item) throw new NotFoundException(`Item id '${event.ItemValue}' does not exist.`);
            targetItemIds.push(item.Id);
        }
        if (event.ItemField === ItemField.ITEM_TITLE) {
            const items = await this.prisma.item.findMany({
                where: {
                    Title: event.ItemValue,
                    DomainId: domain.Id,
                }
            })
            if (!items.length) throw new NotFoundException(`Item title '${event.ItemValue}' does not exist.`);
            targetItemIds.push(...items.map(item => item.Id));
        }

        // 2 rate 3 review
        if (event.EventTypeId === 2 || event.EventTypeId === 3) {
            if (event.RatingValue === null || event.RatingValue === undefined) throw new BadRequestException(`Rating value is required for rating events.`);
            if (event.RatingValue < 1 || event.RatingValue > 5) throw new BadRequestException(`Rating value must be between 1 and 5.`);

            for (const itemId of targetItemIds) {
                await this.prisma.rating.create({
                    data: {
                        UserId: user.Id,
                        ItemId: itemId,
                        Value: event.RatingValue,
                        ReviewText: event.RatingReview,
                        CreatedAt: event.Timestamp,
                        DomainId: domain.Id,
                    }
                });
            }
        } else {
            for (const itemId of targetItemIds) {
                await this.prisma.interaction.create({
                    data: {
                        UserId: user.Id,
                        ItemId: itemId,
                        InteractionTypeId: event.EventTypeId,
                        CreatedAt: event.Timestamp,
                        DomainId: domain.Id,
                    }
                });
            }
        }

        const createdEvent = await this.prisma.event.create({
            data: {
                EventTypeId: event.EventTypeId,
                UserField: event.UserField,
                UserValue: event.UserValue,
                ItemField: event.ItemField,
                ItemValue: event.ItemValue,
                RatingValue: event.RatingValue,
                ReviewValue: event.RatingReview,
                Timestamp: event.Timestamp,
                TrackingRuleId: event.TrackingRuleId,
            }
        });

        return createdEvent.Id;
    }
}
