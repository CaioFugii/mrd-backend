import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { Addon } from './entities/addon.entity';
import { AddonsController } from './addons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Addon])],
  providers: [ProductsService],
  controllers: [ProductsController, AddonsController],
})
export class ProductsModule {}
