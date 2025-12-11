import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventService {
    constructor(private prisma: PrismaService) { }
    
    async addEvent(event: CreateEventDto) {
        if (!(await this.prisma.domain.findUnique({
            where: {
                Key: event.DomainKey,
            }
        }))) return null;

        if (!(await this.prisma.triggerEvent.findUnique({
            where: {
                Id: event.TriggerTypeId,
            }
        }))) return null;

        if (!(await this.prisma.user.findUnique({
            where: {
                Id: event.Payload.UserId,
            }
        }))) return null;

        if (!(await this.prisma.item.findUnique({
            where: {
                Id: event.Payload.ItemId,
            }
        }))) return null;

        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: event.DomainKey,
            }
        });

        if (!domain) return null;

        if (event.TriggerTypeId === 2) // Rate
        {
            if (event.Rate?.Value === null || event.Rate?.Value === undefined) return null;
            if (event.Rate.Value < 1 || event.Rate.Value > 5) return null;

            const createdEvent = await this.prisma.rating.create({
                data: {
                    UserId: event.Payload.UserId,
                    ItemId: event.Payload.ItemId,
                    Value: event.Rate.Value,
                    ReviewText: event.Rate.Review,
                    CreatedAt: event.Timestamp,
                    DomainId: domain.Id,
                } 
            });

            return createdEvent.Id;
        } else {
            
            const createdEvent = await this.prisma.interaction.create({
                data: {
                    UserId: event.Payload.UserId,
                    ItemId: event.Payload.ItemId,
                    InteractionTypeId: event.TriggerTypeId,
                    CreatedAt: event.Timestamp,
                    DomainId: domain.Id,
                } 
            });

            return createdEvent.Id;
        }
    }
}
