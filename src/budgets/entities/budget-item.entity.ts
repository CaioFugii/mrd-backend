import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Budget } from './budget.entity';
import { Product } from 'src/products/product.entity';

@Entity('budget_items')
export class BudgetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Budget, (budget) => budget.items)
  budget: Budget;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;
}
