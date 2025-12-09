import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class ReturnMethodService {
    constructor(private prisma: PrismaService) { }
    
    async getReturnMethodsByDomainKey(key: string) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key
            }
        });
        
        if (!domain) return null;
        
        const domainReturns = await this.prisma.domainReturn.findMany({
            where: {
                DomainID: domain.Id
            },
        });
        return domainReturns;
    }

    async createReturnMethods(key: string, slotName: string, returnMethodId: number, value: string, targetUrl: string) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key
            }
        });

        if (!domain) return null;

        if (!targetUrl.startsWith(domain.Url) && !targetUrl.startsWith(domain.Url)) return null;

        const domainReturnExists = await this.prisma.domainReturn.findUnique({
            where: {
                DomainID_SlotName: {
                    DomainID: domain.Id,
                    SlotName: slotName,
                },
            }
        });

        if (domainReturnExists) return null;

        const returnMethod = await this.prisma.returnMethod.findUnique({
            where: {
                Id: returnMethodId
            }
        });

        if (!returnMethod) return null;

        const domainReturn = await this.prisma.domainReturn.create({
            data: {
                DomainID: domain.Id,
                SlotName: slotName,
                ReturnMethodID: returnMethodId,
                Value: value,
                TargetUrl: targetUrl
            }
        });

        return domainReturn;
    }
}