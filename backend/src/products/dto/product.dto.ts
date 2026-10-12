import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/transforms.js';

export class CreateProductDto {
  /** @example "Wireless Headphones" */
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /**
   * Price in cents. Stripe's minimum charge is 50 cents.
   * @example 4999
   */
  @IsInt({ message: 'Price must be a whole number of cents' })
  @Min(50, { message: 'Price must be at least 50 cents' })
  @Max(1_000_000)
  priceCents: number;

  /** @example "https://picsum.photos/seed/headphones/600/400" */
  @IsOptional()
  @ValidateIf((dto: CreateProductDto) => dto.imageUrl !== '')
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Image URL must be an https URL' },
  )
  imageUrl?: string;

  /** @example "Audio" */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  category?: string;

  /** @example 25 */
  @IsInt({ message: 'Stock must be a whole number' })
  @Min(0, { message: 'Stock cannot be negative' })
  @Max(100_000)
  stock: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
