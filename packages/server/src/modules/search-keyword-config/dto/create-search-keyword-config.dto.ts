import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateSearchKeywordConfigDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'domain-key-123' })
    DomainKey: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'Search Keyword Config Name' })
    ConfigurationName: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: '.div' })
    InputSelector: string;
}