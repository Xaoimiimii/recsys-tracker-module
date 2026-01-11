import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserField } from 'src/common/enums/event.enum';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { User } from 'src/generated/prisma/client';

@Injectable()
export class RecommendationService {
    private readonly logger = new Logger(RecommendationService.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly httpService: HttpService,
    ) { }

    async getRecommendations(anonymousId: string, domainKey: string, numberItems: number = 10, userId?: string) {
        const domain = await this.prisma.domain.findUnique({ where: { Key: domainKey } });
        if (!domain) {
            throw new NotFoundException(`Domain with key '${domainKey}' does not exist.`);
        }

        let user: User | null = null;

        if (userId) {
            user = await this.prisma.user.findUnique({
                where: {
                    AnonymousId_UserId_DomainId: {
                        AnonymousId: anonymousId,
                        UserId: userId,
                        DomainId: domain.Id,    
                    }
                },
            });
        } else {
            user = await this.prisma.user.findFirst({
                where: {
                    AnonymousId: anonymousId,
                    DomainId: domain.Id,
                },
            });
        }

        if (!user) {
            throw new NotFoundException(`User with AnonymousId '${anonymousId}' and UserId '${userId}' does not exist in domain '${domainKey}'.`);
        }

        const items = await this.prisma.predict.findMany({
            where: {
                UserId: user.Id,
            },
            orderBy: {
                Value: 'desc',
            },
        });

        const ratedItems = await this.prisma.rating.findMany({
            where: {
                UserId: user.Id,
            },
        });

        const ratedItemsIds = ratedItems.map((item) => item.ItemId);

        const recommendations = items.filter((item) => !ratedItemsIds.includes(item.ItemId));

        const detailedRecommendations = await Promise.all(
            recommendations.map(async (recommendation) => {
                const item = await this.prisma.item.findUnique({
                    where:
                    {
                        Id: recommendation.ItemId 
                    },
                    select: {
                        Id: true,
                        DomainItemId: true,
                        Title: true,
                        Description: true,
                        ImageUrl: true,
                    }
                });

                return item;
            })
        );

        return detailedRecommendations.slice(0, numberItems);
    }

    async triggerTrainModels() {
        const url =
            process.env.MODEL_URL
                ? `${process.env.MODEL_URL}/api/train`
                : 'http://localhost:8000/api/train';

        const allDomains = await this.prisma.domain.findMany();

        for (const domain of allDomains) {
            try {
                const response = await firstValueFrom(
                    this.httpService.post(url, {
                        domain_id: domain.Id,
                    }),
                );
                this.logger.log(`Domain ${domain.Id} train success`);
            } catch (error) {
                this.logger.error(`Domain ${domain.Id} train failed`);
            }
            
        }
    }
}
