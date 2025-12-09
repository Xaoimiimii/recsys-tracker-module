import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateReturnMethodsDto {
    @IsString()
    @IsNotEmpty()
    key: string;

    @IsString()
    @IsNotEmpty()
    slotName: string;

    @IsNumber()
    @IsNotEmpty()
    returnMethodId: number;

    @IsString()
    @IsNotEmpty()
    targetUrl: string;
    
    @IsString()
    @IsNotEmpty()
    value: string;
}