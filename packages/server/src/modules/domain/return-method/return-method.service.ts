import { BadRequestException, Injectable } from '@nestjs/common';
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

    async createReturnMethods(key: string, configurationName: string, returnMethodId: number, value: string, operatorId: number) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key
            }
        });

        if (!domain) throw new BadRequestException('Domain not found');

        const returnMethod = await this.prisma.returnMethod.findUnique({
            where: {
                Id: returnMethodId
            }
        });

        if (!returnMethod) throw new BadRequestException('Return method not found');

        const operator = await this.prisma.operator.findUnique({
            where: {
                Id: operatorId
            }
        });

        if (!operator) throw new BadRequestException('Operator not found');

        const existingDomainReturn = await this.prisma.domainReturn.findFirst({
            where: {
                DomainID: domain.Id,
                ConfigurationName: configurationName,
                ReturnMethodID: returnMethodId,
            }
        });

        if (existingDomainReturn) {
            throw new BadRequestException('This domain return configuration already exists');
        }

        const domainReturn = await this.prisma.domainReturn.create({
            data: {
                DomainID: domain.Id,
                ConfigurationName: configurationName,
                ReturnMethodID: returnMethodId,
                Value: value,
                OperatorID: operatorId
            }
        });

        return domainReturn;
    }
}