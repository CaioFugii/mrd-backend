import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { Product } from '../../products/product.entity';
import { Budget } from './budget.entity';

@Entity()
export class BudgetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productNameSnapshot: string;

  @Column('decimal', { scale: 2, precision: 10 })
  unitPriceSnapshot: number;

  @Column('int')
  quantity: number;

  @Column('decimal', { scale: 2, precision: 10 })
  totalPrice: number;

  @ManyToOne(() => Budget, (budget) => budget.items, {
    onDelete: 'CASCADE',
  })
  budget: Budget;

  @ManyToOne(() => Product, { eager: true })
  product: Product;
}
