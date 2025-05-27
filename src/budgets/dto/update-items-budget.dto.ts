import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
class AddonsItemDto {
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

class BudgetItemInput {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonsItemDto)
  addons?: AddonsItemDto[];
}

export class UpdateBudgetItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemInput)
  items: BudgetItemInput[];
}
