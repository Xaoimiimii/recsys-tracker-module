import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Item, Prisma } from 'src/generated/prisma/client';
import { Logger } from '@nestjs/common';

type ItemWithCategories = Prisma.ItemGetPayload<{
    include: {
        ItemCategories: {
            include: { Category: true };
        };
    };
}>;

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);
    private readonly INDEX_NAME = 'items';
    constructor(private readonly elasticsearchService: ElasticsearchService) {}

    async search(
        domainId: number,
        keyword?: string,
        priorityCategoryIds?: number[]
    ): Promise<{ items: any[]; total: any }> {
        let mustQuery: any[] = [];
        
        if (keyword && keyword.trim() !== '') {
            mustQuery.push({
                multi_match: {
                    query: keyword,
                    fields: ['title^3', 'description', 'category_names'],
                    operator: 'or',
                    fuzziness: 'AUTO',
                },
            });
        } else {
            mustQuery.push({ match_all: {} });
        }

        const shouldQuery: any[] = [];
        if (priorityCategoryIds && priorityCategoryIds.length > 0) {
            priorityCategoryIds.forEach((catId) => {
                shouldQuery.push({
                    constant_score: {
                        filter: {
                            term: { category_ids: catId }
                        },
                        boost: 10.0
                    }
                });
            });
        }

        let result = await this.elasticsearchService.search({
            index: this.INDEX_NAME,
            query: {
                bool: {
                    filter: [{ term: { domainId: domainId } }],
                    must: mustQuery,
                    should: shouldQuery,
                },
            },
            sort: [
                { _score: { order: 'desc' } } 
            ]
        });

        const totalHits = typeof result.hits.total === 'number' 
            ? result.hits.total 
            : result.hits.total?.value || 0;

        
        if (totalHits === 0 && keyword && keyword.trim() !== '') {
            this.logger.log(`Keyword "${keyword}" not found. Fallback to Category Priority.`);

            mustQuery = [{ match_all: {} }];

            result = await this.elasticsearchService.search({
                index: this.INDEX_NAME,
                query: {
                    bool: {
                        filter: [{ term: { domainId: domainId } }],
                        must: mustQuery,
                        should: shouldQuery,
                        minimum_should_match: 1
                    },
                },
                sort: [{ _score: { order: 'desc' } }]
            });
        }

        return {
            items: result.hits.hits.map((hit) => hit._source),
            total: result.hits.total,
        };
    }

    async searchCategories(
        domainId: number,
        keyword: string,
    ): Promise<{ items: any[]; total: any }> {
        if (!keyword || !domainId) return { items: [], total: 0 };

        const terms = keyword
            .split(/[\s,]+/)
            .filter((t) => t.trim().length > 0);

        const result = await this.elasticsearchService.search({
            index: this.INDEX_NAME,
            query: {
                bool: {
                    filter: [{ term: { domainId: domainId } }],
                    should: terms.map((term) => ({
                        constant_score: {
                            filter: {
                                match: {
                                    category_names: {
                                        query: term,
                                        fuzziness: 'AUTO',
                                        operator: 'and',
                                    },
                                },
                            },
                            boost: 1.0,
                        },
                    })),
                    minimum_should_match: 1,
                },
            },
            sort: [{ _score: { order: 'desc' } }],
        });

        return {
            items: result.hits.hits.map((hit) => hit._source),
            total: result.hits.total,
        };
    }

    async createItemInBulk(items: ItemWithCategories[], domainId: number) {
        try {
            const operations = items.flatMap((item: any) => {
                const categoryNames =
                    item.ItemCategories?.map(
                        (ic: any) => ic.Category?.Name,
                    ).filter((name: string) => name) || [];

                const categoryIds =
                    item.ItemCategories?.map((ic: any) => ic.CategoryId) || [];

                return [
                    {
                        index: {
                            _index: this.INDEX_NAME,
                            _id: item.Id.toString(),
                        },
                    },
                    {
                        id: item.Id,
                        domainId: domainId,
                        title: item.Title,
                        description: item.Description,
                        category_names: categoryNames,
                        category_ids: categoryIds,
                    },
                ];
            });

            const bulkResponse = await this.elasticsearchService.bulk({
                operations: operations,
            });

            if (bulkResponse.errors) {
                const erroredItems: any[] = [];

                bulkResponse.items.forEach((action: any, i) => {
                    const operation = Object.keys(action)[0];

                    if (action[operation].error) {
                        erroredItems.push({
                            status: action[operation].status,
                            error: action[operation].error,
                            itemId: items[i].Id,
                        });
                    }
                });

                this.logger.error(
                    `Bulk index errors: ${JSON.stringify(erroredItems)}`,
                );
            } else {
                this.logger.log(
                    `Indexed ${items.length} items to Elastic successfully.`,
                );
            }
        } catch (error) {
            this.logger.error(`Failed to bulk index: ${error.message}`);
        }
    }
}
