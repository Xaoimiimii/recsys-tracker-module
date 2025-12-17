import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateEventDto {
    @IsNotEmpty()
    @IsNumber()
    TriggerTypeId: number;

    @IsNotEmpty()
    @IsString()
    DomainKey: string;

    @IsNotEmpty()
    Timestamp: string | Date;

    @IsNotEmpty()
    Payload: {
        Username: string;
        ItemId: number;
    }

    @IsOptional()
    Rate: {
        Value: number;
        Review: string;
    }
}