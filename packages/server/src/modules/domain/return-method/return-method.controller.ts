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
import { CreateReturnMethodsDto } from './dto/create-return-method.dto';

@Controller('domain/return-method')
export class ReturnMethodController {
    constructor(private returnMethodService: ReturnMethodService) {}

    @Get(':key')
    async getReturnMethods(@Param('key') key: string) {
        return this.returnMethodService.getReturnMethodsByDomainKey(key);
    }

    @Post()
    async createReturnMethods(@Body() dto: CreateReturnMethodsDto) {
        const result = await this.returnMethodService.createReturnMethods(
            dto.key,
            dto.configurationName,
            dto.returnMethodId,
            dto.value,
            dto.operatorId,
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
