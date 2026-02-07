import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateEvaluationDto {
    @IsString()
    @ApiProperty({ example: "key nao do do" })
    @IsNotEmpty()
    DomainKey: string;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({ example: 1 })
    Rank: number;
}