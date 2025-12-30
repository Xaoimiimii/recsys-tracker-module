import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecommendationService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async getRecommendations(userId: number, numberItems: number = 10) {
        const items = await this.prisma.predict.findMany({
            where: {
                UserId: userId,
            },
            orderBy: {
                Value: 'desc',
            },
        });

        const ratedItems = await this.prisma.rating.findMany({
            where: {
                UserId: userId,
            },
        });

        const ratedItemsIds = ratedItems.map((item) => item.ItemId);

        const recommendations = items.filter((item) => !ratedItemsIds.includes(item.ItemId));

        return recommendations.slice(0, numberItems);
    }
}
