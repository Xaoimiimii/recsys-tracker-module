import { ActionType } from './../../../generated/prisma/enums';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ItemIdentityDto } from './item-identity.dto';

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

    @ApiProperty({ description: "Item identity" })
    @IsNotEmpty()
    ItemIdentity: ItemIdentityDto

    @ApiProperty({ example: "" })
    @IsNotEmpty()
    @IsString()
    TrackingTarget: string;

    @ApiProperty({ example: ActionType.View, enum: ActionType })
    @IsOptional()     
    @IsEnum(ActionType)
    ActionType: ActionType;
}