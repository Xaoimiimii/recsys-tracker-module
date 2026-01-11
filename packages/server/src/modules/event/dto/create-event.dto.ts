import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ItemField } from "src/common/enums/event.enum";

// export class CreateEventDto {
//     @IsNotEmpty()
//     @IsNumber()
//     TriggerTypeId: number;

//     @IsNotEmpty()
//     @IsString()
//     DomainKey: string;

//     @IsNotEmpty()
//     Timestamp: string | Date;

//     @IsNotEmpty()
//     Payload: {
//         Username: string;
//         ItemId: number;
//     }

//     @IsOptional()
//     Rate: {
//         Value: number;
//         Review: string;
//     }
// }

export class CreateEventDto {
    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    EventTypeId: number;

    @ApiProperty({ example: "user-123" })
    @IsOptional()
    @IsString()
    UserId: string;

    @ApiProperty({ example: "anonymous-123" })
    @IsNotEmpty()
    @IsString()
    AnonymousId: string;

    @ApiProperty({ enum: ItemField })
    @IsNotEmpty()
    @IsEnum(ItemField)
    ItemField: ItemField;

    @ApiProperty({ example: "1" })
    @IsNotEmpty()
    @IsString()
    ItemValue: string;

    @ApiProperty({ example: "2025-12-22T18:15:14.123Z" })
    @IsNotEmpty()
    @Type(() => Date)
    Timestamp: Date;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumber()
    RatingValue?: number;

    @ApiPropertyOptional({ example: "This is a review" })
    @IsOptional()
    @IsString()
    RatingReview?: string;

    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    TrackingRuleId: number;
}