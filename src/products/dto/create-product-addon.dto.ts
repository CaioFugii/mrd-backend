import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductAddonDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;
}
