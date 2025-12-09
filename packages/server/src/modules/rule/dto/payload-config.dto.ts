import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PayloadConfigDto {
    @IsInt()
    @IsNotEmpty()
    payloadPatternId: number;

    @IsInt()
    @IsNotEmpty()
    operatorId: number;

    @IsString()
    @IsOptional()
    value?: string;

    @IsString()
    @IsOptional()
    type?: string;
}