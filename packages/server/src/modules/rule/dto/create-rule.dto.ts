import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { ConditionDto } from "./condition.dto";
import { PayloadMappingDto } from "./payload-mapping.dto";
import { TrackingTargetDto } from "./tracking-target.dto";

// export class CreateRuleDto {
//     @IsString()
//     @IsNotEmpty()
//     name: string;

//     @IsString()
//     @IsNotEmpty()
//     domainKey: string;

//     @IsInt()
//     @IsNotEmpty()
//     triggerEventId: number;

//     @IsInt()
//     @IsNotEmpty()
//     targetEventPatternId: number;

//     @IsInt()
//     @IsNotEmpty()
//     targetOperatorId: number;

//     @IsString()
//     @IsNotEmpty()
//     targetElementValue: string;

//     @IsArray()
//     @ValidateNested({ each: true })
//     @Type(() => ConditionDto)
//     conditions: ConditionDto[];

//     @IsArray()
//     @ValidateNested({ each: true })
//     @Type(() => PayloadConfigDto)
//     payloadConfigs: PayloadConfigDto[];
// }

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

    @ApiProperty({ example: "ConditionDto[]" })
    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ConditionDto)
    Conditions: ConditionDto[];

    @ApiProperty({ example: "PayloadMappingDto[]" })
    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => PayloadMappingDto)
    PayloadMappings: PayloadMappingDto[];

    @ApiProperty({ example: "" })
    @IsNotEmpty()
    @Type(() => TrackingTargetDto)
    TrackingTarget: TrackingTargetDto;
}