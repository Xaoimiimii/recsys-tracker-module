import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class DomainService {
    constructor(private prisma: PrismaService) { }
    
    async getDomainByKey(key: string) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key
            },
            include: {
                DomainReturns: {
                    include: {
                        ReturnMethod: true
                    }
                }
            }
        });
        return domain;
    }

    async generateApiKey() : Promise<string>
    {
        while (true)
        {
            const apiKey = randomBytes(32).toString('hex');
            const existing = await this.prisma.domain.findUnique({
                where: {
                    Key: apiKey
                }
            });
            if (!existing) return apiKey;
        }
    }

    async createDomain(ternantId: number, url: string, Type: number)
    {
        if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

        if (!this.prisma.ternant.findUnique({
            where: {
                Id: ternantId
            }
        })) return null;

        const apiKey = await this.generateApiKey();

        const domain = await this.prisma.domain.create({
            data: {
                TernantID: ternantId,
                Key: apiKey,
                Type: Type,
                Url: url,
                CreatedAt: new Date()
            } 
        });

        return domain;
    }

    async getDomainsByTernantId(ternantId: number) {
        const domains = await this.prisma.domain.findMany({
            where: {
                TernantID: ternantId
            }
        });
        return domains;
    }

    async getAllTriggerEvents() {
        const events = await this.prisma.triggerEvent.findMany();
        return events;
    }

    async getAllReturnMethods() {
        const methods = await this.prisma.returnMethod.findMany();
        return methods;
    }
}
