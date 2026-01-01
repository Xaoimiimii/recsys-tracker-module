import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserField } from 'src/common/enums/event.enum';
import { ApiProperty } from '@nestjs/swagger';

export class RecommendationRequestDto {
    @ApiProperty({ example: 'username' })
    @IsString()
    UserValue: string;

    @ApiProperty({ enum: UserField })
    @IsEnum(UserField)
    UserField: UserField;

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
