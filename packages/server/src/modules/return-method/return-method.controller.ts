import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Post,
} from '@nestjs/common';
import { ReturnMethodService } from './return-method.service';
import { CreateReturnMethodDto } from './dto/create-return-method.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('return-method')
export class ReturnMethodController {
    constructor(private returnMethodService: ReturnMethodService) { }

    @Get(':key')
    @ApiOperation({ summary: 'Get all return methods by domain key' })
    async getReturnMethods(@Param('key') key: string) {
        return this.returnMethodService.getReturnMethodsByDomainKey(key);
    }

    @ApiOperation({ summary: 'Create a new return method' })
    @Post()
    async createReturnMethod(@Body() dto: CreateReturnMethodDto) {
        const result = await this.returnMethodService.createReturnMethod(
            dto.Key,
            dto.ConfigurationName,
            dto.ReturnType,
            dto.Value,
            dto.DelayDuration,
            dto.CustomizingFields || [],
            dto.LayoutJson,
            dto.StyleJson,
        );

        if (!result) {
            throw new HttpException(
                { statusCode: 404, message: 'Some error occurred' },
                HttpStatus.NOT_FOUND,
            );
        }

        return {
            statusCode: HttpStatus.CREATED,
            message: 'Return method was created successfully',
        };
    }
}
