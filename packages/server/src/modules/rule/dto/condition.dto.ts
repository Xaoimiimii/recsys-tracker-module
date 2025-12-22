import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class ConditionDto {
    @ApiProperty({ example: "Condition Value" })
    @IsString()
    @IsNotEmpty()
    Value: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @IsNotEmpty()
    PatternId: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @IsNotEmpty()
    OperatorId: number;
}