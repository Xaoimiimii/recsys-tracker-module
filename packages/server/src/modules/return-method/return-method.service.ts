import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ReturnType } from 'src/generated/prisma/enums';
import { CustomizingFieldDto } from './dto/create-return-method.dto';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class ReturnMethodService {
    constructor(private prisma: PrismaService) {}

    async getReturnMethodsByDomainKey(key: string) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key,
            },
        });

        if (!domain) throw new NotFoundException('Domain not found');

        const domainReturns = await this.prisma.returnMethod.findMany({
            where: {
                DomainID: domain.Id,
            },
        });
        return domainReturns;
    }

    async createReturnMethod(
        key: string,
        configurationName: string,
        returnType: ReturnType,
        value: string,
        delayDuration: number,
        customizingFields: CustomizingFieldDto[],
        layoutJson: Record<string, any>,
        styleJson: Record<string, any>,
        SearchKeywordConfigId?: number,
    ) {
        if (delayDuration < 0) {
            throw new BadRequestException(
                'Delay duration must be a non-negative number',
            );
        }

        const usedKeys = new Set<string>();
        const usedPositions = new Set<number>();

        if (customizingFields?.length) {
            for (const field of customizingFields) {
                const currentKey = field.key.trim();

                if (usedKeys.has(currentKey)) {
                    throw new BadRequestException(
                        `Customizing field key "${currentKey}" cannot be duplicated`,
                    );
                }
                usedKeys.add(currentKey);

                if (field.position < 0) {
                    throw new BadRequestException(
                        `Customizing field "${currentKey}" position must be >= 0`,
                    );
                }

                if (field.position !== 0) {
                    if (usedPositions.has(field.position)) {
                        throw new BadRequestException(
                            `Position "${field.position}" is duplicated at field "${currentKey}"`,
                        );
                    }
                    usedPositions.add(field.position);
                }
            }
        }

        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: key,
            },
        });

        if (!domain) throw new NotFoundException('Domain not found');

        const searchKeywordConfig = this.prisma.searchKeywordConfig.findUnique({
            where: {
                Id: SearchKeywordConfigId,
            },
        });

        if (SearchKeywordConfigId && !searchKeywordConfig)
            throw new NotFoundException('Search keyword config not found');

        const domainReturn = await this.prisma.returnMethod.create({
            data: {
                DomainID: domain.Id,
                ConfigurationName: configurationName,
                ReturnType: returnType,
                Value: value,
                Customizing: customizingFields as any,
                Layout: layoutJson,
                Style: styleJson,
                Delay: delayDuration,
                SearchKeywordConfigID: SearchKeywordConfigId,
            },
        });

        return domainReturn;
    }

    async updateReturnMethod(
        id: number,
        configurationName?: string,
        value?: string,
        customizingFields?: CustomizingFieldDto[],
        layoutJson?: Record<string, any>,
        styleJson?: Record<string, any>,
        delayDuration?: number,
        SearchKeywordConfigId?: number,
    ) {
        const existingReturnMethod = await this.prisma.returnMethod.findUnique({
            where: {
                Id: id,
            },
        });

        if (!existingReturnMethod) {
            throw new NotFoundException(`Return method id ${id} not found`);
        }

        if (delayDuration !== undefined && delayDuration < 0) {
            throw new BadRequestException(
                'Delay duration must be a non-negative number',
            );
        }

        if (customizingFields && customizingFields.length > 0) {
            const usedKeys = new Set<string>();
            const usedPositions = new Set<number>();

            if (customizingFields?.length) {
                for (const field of customizingFields) {
                    const currentKey = field.key.trim();

                    if (usedKeys.has(currentKey)) {
                        throw new BadRequestException(
                            `Customizing field key "${currentKey}" cannot be duplicated`,
                        );
                    }
                    usedKeys.add(currentKey);

                    if (field.position < 0) {
                        throw new BadRequestException(
                            `Customizing field "${currentKey}" position must be >= 0`,
                        );
                    }

                    if (field.position !== 0) {
                        if (usedPositions.has(field.position)) {
                            throw new BadRequestException(
                                `Position "${field.position}" is duplicated at field "${currentKey}"`,
                            );
                        }
                        usedPositions.add(field.position);
                    }
                }
            }
        }

        return await this.prisma.returnMethod.update({
            where: { Id: id },
            data: {
                ConfigurationName: configurationName,
                Value: value,
                Customizing: customizingFields as any,
                Layout: layoutJson,
                Style: styleJson,
                Delay: delayDuration,
                SearchKeywordConfig: SearchKeywordConfigId
                    ? { connect: { Id: SearchKeywordConfigId } }
                    : undefined,
            },
        });
    }

    async deleteReturnMethod(id: number) {
        const existingReturnMethod = await this.prisma.returnMethod.findUnique({
            where: {
                Id: id,
            },
        });
        if (!existingReturnMethod) {
            throw new NotFoundException(`Return method id ${id} not found`);
        }
        await this.prisma.returnMethod.delete({
            where: {
                Id: id,
            },
        });
        return;
    }

    async getReturnMethodById(id: number) {
        const returnMethod = await this.prisma.returnMethod.findUnique({
            where: {
                Id: id,
            },
        });
        if (!returnMethod) {
            throw new NotFoundException(`Return method id ${id} not found`);
        }
        return returnMethod;
    }

    async getItemAttributes(domainKey: string) {
        const domain = await this.prisma.domain.findUnique({
            where: {
                Key: domainKey,
            },
        });

        if (!domain) throw new BadRequestException('Domain not found');

        const items = await this.prisma.item.findMany({
            where: {
                DomainId: domain.Id,
                AND: [
                    { Attributes: { not: Prisma.DbNull } },
                    { Attributes: { not: Prisma.JsonNull } },
                ],
            },
            select: {
                Attributes: true,
            },
        });

        const attributeSet = new Set<string>();

        for (const item of items) {
            const attrs = item.Attributes as Record<string, any> | null;

            if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs))
                continue;

            Object.keys(attrs).forEach((key) => attributeSet.add(key));
        }

        return Array.from(attributeSet);
    }
}
