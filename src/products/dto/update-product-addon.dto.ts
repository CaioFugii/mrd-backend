import { PartialType } from '@nestjs/mapped-types';
import { CreateProductAddonDto } from './create-product-addon.dto';

export class UpdateProductAddonDto extends PartialType(CreateProductAddonDto) {}
