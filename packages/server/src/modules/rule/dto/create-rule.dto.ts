import { ActionType } from './../../../generated/prisma/enums';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PayloadMappingDto } from './payload-mapping.dto';

export class CreateRuleDto {
    @ApiProperty({ example: "Rule Name" })
    @IsString()
    @IsNotEmpty()
    Name: string;

    @ApiProperty({ example: "adnuqwhw12389kahssd9" })
    @IsString()
    @IsNotEmpty()
    DomainKey: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @IsNotEmpty()
    EventTypeId: number;

    @ApiProperty({ description: "Payload mappings" })
    @IsNotEmpty()
    @IsArray()
    PayloadMappings: PayloadMappingDto[]

    @ApiProperty({ example: "" })
    @IsNotEmpty()
    @IsString()
    TrackingTarget: string;

    @ApiProperty({ example: ActionType.View, enum: ActionType })
    @IsOptional()     
    @IsEnum(ActionType)
    ActionType: ActionType;
}