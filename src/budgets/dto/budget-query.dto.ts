// src/budgets/dto/budget-query.dto.ts
import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyPendingApproval?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlySold?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  orderBy?: 'ASC' | 'DESC';
}
