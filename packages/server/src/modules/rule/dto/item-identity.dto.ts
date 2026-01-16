import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional } from "class-validator";
import { ItemIdentitySource } from "src/generated/prisma/enums";

export class ItemIdentityDto {
    @ApiProperty({ enum: ItemIdentitySource, example: ItemIdentitySource.request_body })
    @IsEnum(ItemIdentitySource)
    @IsNotEmpty()
    Source: ItemIdentitySource

    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    TrackingRuleId: number

    @ApiProperty()
    @IsObject()
    @IsOptional()
    RequestConfig: Object
}