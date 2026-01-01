import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserField } from 'src/common/enums/event.enum';

@Injectable()
export class RecommendationService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async getRecommendations(userValue: string, userField: UserField, domainKey: string, numberItems: number = 10) {
        if (!await this.prisma.domain.findUnique({ where: { Key: domainKey } })) {
            throw new NotFoundException(`Domain with key '${domainKey}' does not exist.`);
        }

        const user = await this.prisma.user.findFirst({
            where:
                userField === UserField.USERNAME
                    ? { Username: userValue, Domain: { Key: domainKey } }
                    : { DomainUserId: userValue, Domain: { Key: domainKey } },
        });

        if (!user) {
            throw new NotFoundException(`User with ${userField} '${userValue}' does not exist in domain '${domainKey}'.`);
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
                    }
                });

                return item;
            })
        );

        return detailedRecommendations.slice(0, numberItems);
    }
}
