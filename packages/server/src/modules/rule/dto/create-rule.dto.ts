import { IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { ConditionDto } from "./condition.dto";
import { PayloadConfigDto } from "./payload-config.dto";
import { Type } from "class-transformer";

export class CreateRuleDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @IsNotEmpty()
    domainId: number;

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