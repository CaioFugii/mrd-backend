import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddonsItemDto {
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class UpdateAddonsDto {
  @IsNotEmpty()
  @IsUUID()
  budgetItemId: string;

  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonsItemDto)
  addons?: AddonsItemDto[];
}
