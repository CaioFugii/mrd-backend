import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from 'src/budgets/entities/budget.entity';
import { BudgetItem } from 'src/budgets/entities/budget-item.entity';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { Product } from 'src/products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Budget, BudgetItem, Product])],
  providers: [BudgetsService],
  exports: [BudgetsService],
  controllers: [BudgetsController],
})
export class BudgetsModule {}
