import { SearchKeywordConfig } from './../../../generated/prisma/browser';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ReturnType } from "src/generated/prisma/enums";
import { ApiProperty } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";

export class CustomizingFieldDto {
    @IsString()
    @ApiProperty({ example: 'album' })
    @IsNotEmpty()
    key: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(0)
    @IsNotEmpty()
    position: number;

    @ApiProperty({ example: true })
    @IsBoolean()
    @IsNotEmpty()
    isEnabled: boolean;
}

export class CreateReturnMethodDto {
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

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomizingFieldDto)
    @ApiProperty({
        type: [CustomizingFieldDto],
        example: [
            { key: 'album', position: 1, isEnabled: true },
            { key: 'theme', position: 2, isEnabled: false }
        ]
    })
    CustomizingFields?: CustomizingFieldDto[];

    @IsNotEmpty()
    @IsObject()
    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        example: {
            displayMode: 'popup',
            modes: {
                carousel: {
                    itemsPerView: 1,
                    gap: 'md',
                    responsive: {
                        xs: { itemsPerView: 1 }
                    }
                }
            },
            wrapper: {
                popup: {
                    position: 'center',
                    widthMode: 'fixed',
                    width: 500
                }
            },
            card: {
                blocks: ['image', 'fields', 'actions'],
                fields: {
                    renderMode: 'stack',
                    gap: 'sm'
                }
            }
        }
    })
    LayoutJson: Record<string, any>;

    @IsNotEmpty()
    @IsObject()
    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        example: {
            theme: 'light',
            tokens: {
                colors: {
                    overlay: 'rgba(0,0,0,0.5)'
                },
            }
        }
    })
    StyleJson: Record<string, any>;

    @IsNumber()
    @IsNotEmpty()
    @ApiProperty({ example: 60 })
    DelayDuration: number;

    @IsOptional()
    @IsNumber()
    @ApiProperty({ example: 1 })
    SearchKeywordConfigId?: number;
}