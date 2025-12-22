import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PayloadField, PayloadRequestMethod, PayloadSource, PayloadUrlPart } from "src/generated/prisma/enums";

export class PayloadMappingDto {
    @ApiProperty({ enum: PayloadField, description: 'Trường dữ liệu cần map' })
    @IsNotEmpty()
    @IsEnum(PayloadField)
    Field: PayloadField;

    @ApiProperty({ enum: PayloadSource, description: 'Nguồn lấy dữ liệu' })
    @IsNotEmpty()
    @IsEnum(PayloadSource)
    Source: PayloadSource;

    @ApiPropertyOptional({ description: 'Giá trị key cho Cookie/Storage hoặc Selector cho Element' })
    @IsOptional()
    @IsString()
    Value?: string;

    @ApiPropertyOptional({ description: 'Pattern của URL để kích hoạt mapping' })
    @IsOptional()
    @IsString()
    RequestUrlPattern?: string;

    @ApiPropertyOptional({ enum: PayloadRequestMethod, description: 'Method HTTP áp dụng' })
    @IsOptional()
    @IsEnum(PayloadRequestMethod)
    RequestMethod?: PayloadRequestMethod;

    @ApiPropertyOptional({ description: 'Đường dẫn trong JSON Body (ví dụ: data.user.id)' })
    @IsOptional()
    @IsString()
    RequestBodyPath?: string;

    @ApiPropertyOptional({ enum: PayloadUrlPart, description: 'Lấy từ đâu' })
    @IsOptional()
    @IsEnum(PayloadUrlPart)
    UrlPart?: PayloadUrlPart;

    @ApiPropertyOptional({ description: 'Tên key của query param (nếu urlPart là query_param)' })
    @IsOptional()
    @IsString()
    UrlPartValue?: string;
}   