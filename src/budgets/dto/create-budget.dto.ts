import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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

class BudgetItemInput {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonsItemDto)
  addons?: AddonsItemDto[];
}

export class CreateBudgetDto {
  @IsNotEmpty()
  @IsString()
  customerName: string;

  @IsEmail()
  @IsOptional()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPercent: number;

  @IsBoolean()
  @IsNotEmpty()
  issueInvoice: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemInput)
  items: BudgetItemInput[];
}
