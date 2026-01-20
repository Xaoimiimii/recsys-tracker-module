import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Domain')
@Controller('domain')
export class DomainController {
    constructor(private domainService: DomainService) { }

    @Get(':key')
    @ApiOperation({ summary: 'Get domain by key' })
    async getDomainByKey(@Param('key') key: string) {
        return this.domainService.getDomainByKey(key);
    }

    @Post('create')
    @ApiOperation({ summary: 'Create a new domain' })
    async createDomain(@Body() body: CreateDomainDto) {
        const { ternantId, url, type } = body;
        return this.domainService.createDomain(ternantId, url, type);
    }

    @Get('/ternant/:id')
    @ApiOperation({ summary: 'Get domains by ternant id' })
    async getDomainsByTernantId(@Param('id', ParseIntPipe) id: number) {
        return this.domainService.getDomainsByTernantId(id);
    }

    @Get('return-method/all')
    @ApiOperation({ summary: 'Get all return methods' })
    async getAllReturnMethods() {
        return this.domainService.getAllReturnMethods();
    }

    @Get("/user-identity")
    async getUserIdentity(
        @Query('key') key: string
    ) {
        return this.domainService.getUserIdentity(key);
    }
}