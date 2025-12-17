import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';

@Controller('domain')
export class DomainController {
    constructor(private domainService: DomainService) { }

    @Get(':key')
    async getDomainByKey(@Param('key') key: string) {
        return this.domainService.getDomainByKey(key);
    }

    @Post('create')
    async createDomain(@Body() body: CreateDomainDto) {
        const { ternantId, url, type } = body;
        return this.domainService.createDomain(ternantId, url, type);
    }

    @Get('/ternant/:id')
    async getDomainsByTernantId(@Param('id', ParseIntPipe) id: number) {
        return this.domainService.getDomainsByTernantId(id);
    }

    @Get('trigger-event/all')
    async getAllTriggerEvents() {
        return this.domainService.getAllTriggerEvents();
    }

    @Get('return-method/all')
    async getAllReturnMethods() {
        return this.domainService.getAllReturnMethods();
    }
}