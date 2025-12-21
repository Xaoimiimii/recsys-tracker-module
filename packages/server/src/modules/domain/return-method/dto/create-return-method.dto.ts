import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateReturnMethodsDto {
    @IsString()
    @IsNotEmpty()
    key: string;

    @IsString()
    @IsNotEmpty()
    configurationName: string;

    @IsNumber()
    @IsNotEmpty()
    returnMethodId: number;

    @IsString()
    @IsNotEmpty()
    value: string;

    @IsNumber()
    @IsNotEmpty()
    operatorId: number;
}