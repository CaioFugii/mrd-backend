import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BudgetItemInput {
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateBudgetDto {
  @IsNotEmpty()
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  customerPhone: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemInput)
  items: BudgetItemInput[];

  @IsNumber()
  @Min(0)
  discountPercent: number;
}
