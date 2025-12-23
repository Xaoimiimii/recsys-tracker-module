import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ReturnType } from "src/generated/prisma/enums";
import { ApiProperty } from "@nestjs/swagger";

export class CreateReturnMethodsDto {
    @ApiProperty({ example: 'domain key' })
    @IsString()
    @IsNotEmpty()
    Key: string;

    @ApiProperty({ example: 'configuration name' })
    @IsString()
    @IsNotEmpty()
    ConfigurationName: string;

    @ApiProperty({ enum: ReturnType, example: 'POPUP' })
    @IsEnum(ReturnType)
    @IsNotEmpty()
    ReturnType: ReturnType;

    @ApiProperty({ example: 'value' })
    @IsString()
    @IsNotEmpty()
    Value: string;

    @ApiProperty({ example: 1 })
    @IsNumber()
    @IsNotEmpty()
    OperatorId: number;
}