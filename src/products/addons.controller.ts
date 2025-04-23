import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { User, UserRole } from '../users/user.entity';
import { Roles, RolesGuard } from 'src/shared/guard/roles.guard';
import { JwtAuthGuard } from 'src/shared/guard/jwt-auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { CreateProductAddonDto } from './dto/create-product-addon.dto';
import { UpdateProductAddonDto } from './dto/update-product-addon.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('addons')
export class AddonsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.SUPER_USER)
  create(@Body() dto: CreateProductAddonDto, @CurrentUser() user: User) {
    return this.productsService.createAddon(dto, user);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_USER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductAddonDto,
    @CurrentUser() user: User,
  ) {
    return this.productsService.updateAddon(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_USER)
  disableProductAddon(@Param('id') id: string, @CurrentUser() user: User) {
    return this.productsService.disableProductAddon(id, user);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'name' | 'price' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.productsService.findAddons({
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOneAddon(id);
  }
}
