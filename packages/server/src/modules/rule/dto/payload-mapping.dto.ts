import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional } from "class-validator";
import { PayloadMappingField, PayloadMappingSource } from "src/generated/prisma/enums";

export class PayloadMappingDto {
    @ApiProperty({ enum: PayloadMappingField, example: PayloadMappingField.ItemId })
    @IsEnum(PayloadMappingField)
    @IsNotEmpty()
    Field: PayloadMappingField
    
    @ApiProperty({ enum: PayloadMappingSource, example: PayloadMappingSource.request_body })
    @IsEnum(PayloadMappingSource)
    @IsNotEmpty()
    Source: PayloadMappingSource

    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    TrackingRuleId: number

    @ApiProperty()
    @IsObject()
    @IsOptional()
    Config: Object
}