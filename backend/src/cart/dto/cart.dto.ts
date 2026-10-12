import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_QUANTITY_PER_ITEM = 20;

export class SetQuantityDto {
  /** @example 2 */
  @IsInt({ message: 'Quantity must be a whole number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(MAX_QUANTITY_PER_ITEM, {
    message: `Quantity must be at most ${MAX_QUANTITY_PER_ITEM}`,
  })
  quantity: number;
}

export class CartLineDto extends SetQuantityDto {
  @IsUUID('all', { message: 'Product id is not valid' })
  productId: string;
}

// Items a visitor added before logging in, merged into their saved cart.
export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  items: CartLineDto[];
}
