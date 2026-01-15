import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Item } from 'src/generated/prisma/client';
import { Logger } from '@nestjs/common';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);
    private readonly INDEX_NAME = 'items';
    constructor(private readonly elasticsearchService: ElasticsearchService) { }

    async search(domainId: number, keyword: string): Promise<{ items: any[]; total: any }> {
        const result = await this.elasticsearchService.search({
            index: this.INDEX_NAME,
            query: {
                bool: {
                    filter: [
                        { term: { domainId: domainId } }
                    ],
                    must: [
                        {
                            multi_match: {
                                query: keyword,
                                fields: ['title^3', 'description'], 
                                operator: 'or', 
                                fuzziness: 'AUTO', 
                            },
                        },
                    ],
                },
            },
        });

        return {
            items: result.hits.hits.map((hit) => hit._source),
            total: result.hits.total,
        };
    }

    async createItemInBulk(items: Item[], domainId: number) {
        try {
            const operations = items.flatMap((item) => [
                {
                    index: { _index: this.INDEX_NAME, _id: item.Id.toString() },
                },
                {
                    id: item.Id,
                    domainId: domainId,
                    title: item.Title,
                    description: item.Description,
                },
            ]);

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

                this.logger.error(`Bulk index errors: ${JSON.stringify(erroredItems)}`,);
            } else {
                this.logger.log(`Indexed ${items.length} items to Elastic successfully.`,);
            }
        } catch (error) {
            this.logger.error(`Failed to bulk index: ${error.message}`);
        }
    }
}
