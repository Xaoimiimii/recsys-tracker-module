import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReturnType } from 'src/generated/prisma/enums';
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

        if (!domain) throw new NotFoundException("Domain not found");

        const domainReturns = await this.prisma.returnMethod.findMany({
            where: {
                DomainID: domain.Id
            },
        });
        return domainReturns;
    }

    async createReturnMethods(key: string, configurationName: string, returnType: ReturnType, value: string, operatorId: number) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key
            }
        });

        if (!domain) throw new NotFoundException('Domain not found');

        const operator = await this.prisma.operator.findUnique({
            where: {
                Id: operatorId
            }
        });

        if (!operator) throw new NotFoundException('Operator not found');

        const domainReturn = await this.prisma.returnMethod.create({
            data: {
                DomainID: domain.Id,
                ConfigurationName: configurationName,
                ReturnType: returnType,
                Value: value,
                OperatorID: operatorId
            }
        });

        return domainReturn;
    }
}