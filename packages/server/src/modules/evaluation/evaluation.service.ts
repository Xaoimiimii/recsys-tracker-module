import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvaluationService {
    constructor(private readonly prisma: PrismaService) { }

    async createEvaluation(
        domainKey: string,
        rank: number
    ) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: domainKey
            }
        });

        if (!domain) throw new BadRequestException(`Domain with key ${domainKey} not found`);

        return await this.prisma.evaluation.create({
            data: {
                DomainId: domain.Id,
                Rank: rank,
                Timestamp: new Date(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getTime() + 7 * 60 * 60 * 1000)
            }
        })
    }
}
