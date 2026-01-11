import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserField } from 'src/common/enums/event.enum';
import { ApiProperty } from '@nestjs/swagger';

export class RecommendationRequestDto {
    @ApiProperty({ example: 'username' })
    @IsString()
    @IsOptional()
    UserId?: string;

    @ApiProperty({ example: 'anonymous_id_123123123' })
    @IsString()
    @IsNotEmpty()
    AnonymousId: string;

    @ApiProperty({ example: 'domain_key' })
    @IsString()
    DomainKey: string;
    
    @ApiProperty({ example: 10, required: false })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    @IsOptional()
    NumberItems?: number = 10;
}
