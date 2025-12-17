import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
        }))) throw new NotFoundException(`Domain key '${event.DomainKey}' does not exist.`);

        if (!(await this.prisma.triggerEvent.findUnique({
            where: {
                Id: event.TriggerTypeId,
            }
        }))) throw new NotFoundException(`Trigger event id '${event.TriggerTypeId}' does not exist.`);

        const domainByKey = await this.prisma.domain.findUnique({
            where: {
                Key: event.DomainKey,
            }
        });

        if (!domainByKey) throw new NotFoundException(`Domain key '${event.DomainKey}' does not exist.`);

        if (!(await this.prisma.user.findUnique({
            where: {
                Username_DomainId: {
                    Username: event.Payload.Username,
                    DomainId: domainByKey.Id,
                },
            }
        }))) {
            const createdUser = await this.prisma.user.create({
                data: {
                    Username: event.Payload.Username,
                    DomainId: domainByKey.Id,
                    CreatedAt: new Date(),
                } 
            });
        }

        if (!(await this.prisma.item.findUnique({
            where: {
                Id: event.Payload.ItemId,
            }
        }))) throw new NotFoundException(`Item id '${event.Payload.ItemId}' does not exist.`);

        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: event.DomainKey,
            }
        });

        if (!domain) return null;

        if (event.TriggerTypeId === 2)
        {
            if (event.Rate?.Value === null || event.Rate?.Value === undefined) throw new BadRequestException(`Rating value is required for rating events.`);
            if (event.Rate.Value < 1 || event.Rate.Value > 5) throw new BadRequestException(`Rating value must be between 1 and 5.`);

            const createdEvent = await this.prisma.rating.create({
                data: {
                    Username: event.Payload.Username,
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
                    Username: event.Payload.Username,
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
