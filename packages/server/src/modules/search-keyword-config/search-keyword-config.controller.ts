import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SearchKeywordConfigService } from './search-keyword-config.service';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CreateSearchKeywordConfigDto } from './dto/create-search-keyword-config.dto';

@Controller('search-keyword-config')
export class SearchKeywordConfigController {
    constructor(private readonly searchKeywordConfigService: SearchKeywordConfigService) { }
    
    @Post()
    @ApiOperation({ summary: 'Create a new search keyword config' })
    async createConfig(@Body() body: CreateSearchKeywordConfigDto) {
        return this.searchKeywordConfigService.createSearchKeywordConfig(
            body.DomainKey,
            body.ConfigurationName,
            body.InputSelector
        );
    }

    @Get()
    @ApiOperation({ summary: 'Get search keyword configs by domain key' })
    @ApiQuery({
        name: 'domainKey',
        type: String,
        required: true,
        description: 'Domain key to filter search keyword configs',
    })
    async getConfigs(@Query('domainKey') domainKey: string) {
        return this.searchKeywordConfigService.getSearchKeywordConfigs(domainKey);
    }
}
