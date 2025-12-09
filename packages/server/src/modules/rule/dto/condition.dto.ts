import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ConditionDto {
    @IsInt()
    @IsNotEmpty()
    eventPatternId: number;

    @IsInt()
    @IsNotEmpty()
    operatorId: number;

    @IsString()
    @IsNotEmpty()
    value: string;
}