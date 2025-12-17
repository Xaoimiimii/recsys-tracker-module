import { IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { ConditionDto } from "./condition.dto";
import { PayloadConfigDto } from "./payload-config.dto";
import { Type } from "class-transformer";

export class CreateRuleDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    domainKey: string;

    @IsInt()
    @IsNotEmpty()
    triggerEventId: number;

    @IsInt()
    @IsNotEmpty()
    targetEventPatternId: number;

    @IsInt()
    @IsNotEmpty()
    targetOperatorId: number;

    @IsString()
    @IsNotEmpty()
    targetElementValue: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ConditionDto)
    conditions: ConditionDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PayloadConfigDto)
    payloadConfigs: PayloadConfigDto[];
}