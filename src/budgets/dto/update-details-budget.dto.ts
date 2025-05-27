import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateBudgetDetailsDto {
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

  @IsNumber()
  @Min(0)
  @Max(3)
  @IsOptional()
  commissionPercent: number;

  @IsBoolean()
  @IsNotEmpty()
  issueInvoice: boolean;
}
