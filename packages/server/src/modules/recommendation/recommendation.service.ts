import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserField } from 'src/common/enums/event.enum';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Event, Item, User } from 'src/generated/prisma/client';
import { SearchService } from '../search/search.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RecommendationService {
    private readonly logger = new Logger(RecommendationService.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly httpService: HttpService,
        private readonly searchService: SearchService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) { }

    async getRecommendations(domainKey: string, numberItems: number = 10, anonymousId?: string, userId?: string) {
        const domain = await this.prisma.domain.findUnique({ where: { Key: domainKey } });
        if (!domain) {
            throw new NotFoundException(`Domain with key '${domainKey}' does not exist.`);
        }
        let user: User | null = null;
        let itemHistory: Event[] | null = null;

        if (userId) {
            user = await this.prisma.user.findFirst({
                where: {
                    UserId: userId,
                    DomainId: domain.Id,    
                },
            });

            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000 + 7 * 60 * 60 * 1000);

            itemHistory = await this.prisma.event.findMany({
                where: {
                    UserId: userId,
                    TrackingRule: {
                        DomainID: domain.Id
                    },
                    Timestamp: {
                        gte: fifteenMinutesAgo
                    }
                },
                orderBy: {
                    Timestamp: "desc"
                },
                take: 10
            });

        } else {
            user = await this.prisma.user.findFirst({
                where: {
                    AnonymousId: anonymousId,
                    DomainId: domain.Id,
                },
            });

            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000 + 7 * 60 * 60 * 1000);
            console.log(fifteenMinutesAgo);
            itemHistory = await this.prisma.event.findMany({
                where: {
                    AnonymousId: anonymousId,
                    TrackingRule: {
                        DomainID: domain.Id
                    },
                    Timestamp: {
                        gte: fifteenMinutesAgo
                    },
                },
                orderBy: {
                    Timestamp: "desc"
                },
                take: 10
            })
        }
        if (!user) {
            // return top k items based on other user
            const topItemsByAvgPredict = await this.prisma.predict.groupBy({
                where: {
                    Item: {
                        DomainId: domain.Id
                    }
                },
                by: ['ItemId'],
                _avg: {
                    Value: true
                },
                orderBy: {
                    _avg: {
                        Value: 'desc'
                    }
                },
                take: numberItems * 2
            });

            if (!topItemsByAvgPredict || topItemsByAvgPredict.length <= 0) {
                let recommendation = await this.prisma.item.findMany({
                    where: {
                        DomainId: domain.Id,
                    },
                    select: {
                        Id: true,
                        DomainItemId: true,
                        Title: true,
                        Description: true,
                        ImageUrl: true,
                        ItemCategories: {
                            select: {
                                Category: {
                                    select: {
                                        Name: true
                                    }
                                }
                            }
                        },
                        Attributes: true
                    },
                    take: numberItems
                });

                return recommendation.map(item => ({
                    Id: item?.Id,
                    DomainItemId: item?.DomainItemId,
                    Title: item?.Title,
                    Description: item?.Description,
                    ImageUrl: item?.ImageUrl,
                    Categories: item?.ItemCategories.map(ic => ic.Category.Name),
                    ...((item?.Attributes as Record<string, any>) || {})
                }));
            }

            const topItemIds = topItemsByAvgPredict
                .map(item => item.ItemId);

            let recommendations = topItemIds.map((itemId, index) => ({
                ItemId: itemId,
                Value: topItemsByAvgPredict[index]._avg.Value || 0
            }));

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
                            ItemCategories: {
                                select: {
                                    Category: {
                                        select: {
                                            Name: true
                                        }
                                    }
                                }
                            },
                            Attributes: true
                        }
                    });

                    return {
                        Id: item?.Id,
                        DomainItemId: item?.DomainItemId,
                        Title: item?.Title,
                        Description: item?.Description,
                        ImageUrl: item?.ImageUrl,
                        Categories: item?.ItemCategories.map(ic => ic.Category.Name),
                        ...((item?.Attributes as Record<string, any>) || {})
                    };
                })
            );
            return detailedRecommendations.slice(0, numberItems);
        }

        let priorityCategoryIds: number[] = [];

        if (itemHistory && itemHistory.length > 0) {
            this.logger.log(`Found ${itemHistory.length} events in history (within 15 min window)`);
            
            const historyDomainItemIds = itemHistory
                .map((event) => event.ItemId)
                .filter((id): id is string => id !== null);

            if (historyDomainItemIds.length > 0) {
                const categories = await this.prisma.itemCategory.findMany({
                    where: {
                        Item: {
                            DomainItemId: { in: historyDomainItemIds }
                        }
                    },
                    select: {
                        CategoryId: true,
                    },
                    distinct: ['CategoryId'],
                });

                priorityCategoryIds = categories.map((c) => c.CategoryId);
                this.logger.log(`Priority category IDs from history: [${priorityCategoryIds.join(', ')}]`);
            }
        }

        const cacheKeywordKey = `recommendation_keyword_${user.Id}`;
        const cachedKeyword = await this.cacheManager.get<string>(cacheKeywordKey);
        
        let priorityItems: any[] = [];
        let allItems: any[] = [];

        // Get all items for this user
        allItems = await this.prisma.predict.findMany({
            where: { UserId: user.Id },
            orderBy: { Value: 'desc' },
        });

        this.logger.log(`User ${user.Id} has ${allItems.length} predict items in database`);

        if (cachedKeyword || priorityCategoryIds.length > 0) {
            const keywordToSearch = cachedKeyword || "";
            
            if (cachedKeyword) {
                this.logger.log(`Cache hit keyword: "${cachedKeyword}"`);
            } else {
                this.logger.log(`No cache keyword, searching by Priority Categories: [${priorityCategoryIds.join(', ')}]`);
            }

            const searchResult = await this.searchService.search(
                domain.Id, 
                keywordToSearch, 
                priorityCategoryIds
            );
            
            this.logger.log(`Search returned ${searchResult.items?.length || 0} items`);
            
            // If no predict data, use search results directly
            if (allItems.length === 0 && searchResult.items?.length > 0) {
                this.logger.log(`No predict data available, using search results directly`);
                
                const ratedItems = await this.prisma.rating.findMany({
                    where: { UserId: user.Id },
                });
                const ratedItemsIds = ratedItems.map(item => item.ItemId);
                
                // Get items from search results that haven't been rated
                const searchItemIds = searchResult.items
                    .map(item => item.id)
                    .filter(id => !ratedItemsIds.includes(id))
                    .slice(0, numberItems);
                
                const detailedRecommendations = await Promise.all(
                    searchItemIds.map(async (itemId) => {
                        const item = await this.prisma.item.findUnique({
                            where: { Id: itemId },
                            select: {
                                Id: true,
                                DomainItemId: true,
                                Title: true,
                                Description: true,
                                ImageUrl: true,
                                ItemCategories: {
                                    select: {
                                        Category: {
                                            select: {
                                                Name: true
                                            }
                                        }
                                    }
                                },
                                Attributes: true
                            }
                        });

                        return {
                            Id: item?.Id,
                            DomainItemId: item?.DomainItemId,
                            Title: item?.Title,
                            Description: item?.Description,
                            ImageUrl: item?.ImageUrl,
                            Categories: item?.ItemCategories.map(ic => ic.Category.Name),
                            ...((item?.Attributes as Record<string, any>) || {})
                        };
                    })
                );
                
                return detailedRecommendations;
            }
            
            const priorityItemIds = searchResult.items.map(item => item.id);
            this.logger.log(`Search item IDs: [${priorityItemIds.slice(0, 5).join(', ')}${priorityItemIds.length > 5 ? '...' : ''}]`);
            
            if (allItems.length > 0) {
                const predictItemIds = allItems.slice(0, 5).map(p => p.ItemId);
                this.logger.log(`Predict item IDs (first 5): [${predictItemIds.join(', ')}]`);
            }

            // priority items (in search result) and other items
            priorityItems = allItems.filter(item => priorityItemIds.includes(item.ItemId));
            const otherItems = allItems.filter(item => !priorityItemIds.includes(item.ItemId));

            // priority items first, then other items
            allItems = [...priorityItems, ...otherItems];
            
            this.logger.log(`Found ${priorityItems.length} priority items from search, ${otherItems.length} other items`);
        } else {
            this.logger.log(`No keyword or priority categories for user ${user.Id}`);
        }

        const ratedItems = await this.prisma.rating.findMany({
            where: {
                UserId: user.Id,
            },
        });

        const ratedItemsIds = ratedItems.map((item) => item.ItemId);

        let recommendations = allItems.filter((item) => !ratedItemsIds.includes(item.ItemId));

        if (!recommendations || recommendations.length === 0) {
            const topItemsByAvgPredict = await this.prisma.predict.groupBy({
                where: {
                    Item: {
                        DomainId: domain.Id
                    }
                },
                by: ['ItemId'],
                _avg: {
                    Value: true
                },
                orderBy: {
                    _avg: {
                        Value: 'desc'
                    }
                },
                take: numberItems * 2
            });

            const topItemIds = topItemsByAvgPredict
                .filter(item => !ratedItemsIds.includes(item.ItemId))
                .map(item => item.ItemId);

            recommendations = topItemIds.map((itemId, index) => ({
                ItemId: itemId,
                UserId: user!.Id,
                Value: topItemsByAvgPredict[index]._avg.Value || 0
            }));

            if (recommendations.length <= 0) {
                recommendations = await this.prisma.item.findMany({
                    where: {
                        DomainId: domain.Id,
                    },
                    select: {
                        Id: true,
                        DomainItemId: true,
                        Title: true,
                        Description: true,
                        ImageUrl: true,
                        ItemCategories: {
                            select: {
                                Category: {
                                    select: {
                                        Name: true
                                    }
                                }
                            }
                        },
                        Attributes: true
                    },
                    take: numberItems
                });

                return recommendations.map(item => ({
                    Id: item?.Id,
                    DomainItemId: item?.DomainItemId,
                    Title: item?.Title,
                    Description: item?.Description,
                    ImageUrl: item?.ImageUrl,
                    Categories: item?.ItemCategories.map(ic => ic.Category.Name),
                    ...((item?.Attributes as Record<string, any>) || {})
                }));
            }
        }

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
                        ItemCategories: {
                            select: {
                                Category: {
                                    select: {
                                        Name: true
                                    }
                                }
                            }
                        },
                        Attributes: true
                    }
                });

                return {
                    Id: item?.Id,
                    DomainItemId: item?.DomainItemId,
                    Title: item?.Title,
                    Description: item?.Description,
                    ImageUrl: item?.ImageUrl,
                    Categories: item?.ItemCategories.map(ic => ic.Category.Name),
                    ...((item?.Attributes as Record<string, any>) || {})
                };
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

    async pushRecommendationKeyword(
        anonymousId: string,
        domainKey: string,
        keyword: string,
        userId?: string
    ) {
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

            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        UserId: userId,
                        DomainId: domain.Id,
                        CreatedAt: new Date()
                    }
                })
            }
        }
        else {
            user = await this.prisma.user.findFirst({
                where: {
                    AnonymousId: anonymousId,
                    DomainId: domain.Id,
                },
            });

            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        AnonymousId: anonymousId,
                        DomainId: domain.Id,
                        CreatedAt: new Date()
                    }
                })
            }
        }

        const cacheKeywordKey = `recommendation_keyword_${user.Id}`;
        const ttl = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        await this.cacheManager.set(cacheKeywordKey, keyword, ttl);
        this.logger.log(`Set recommendation keyword cache for user ${user.Id} with keyword '${keyword}'`);
    }
}
