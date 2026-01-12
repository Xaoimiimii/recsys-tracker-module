import {  IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecommendationPushKeywordDto {
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
    
    @ApiProperty({ example: 'keyword_to_push' })
    @IsString()
    @IsNotEmpty()
    Keyword: string;
}
