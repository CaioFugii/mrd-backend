import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Budget } from './budget.entity';
import { BudgetItemAddon } from './budget-item-addon.entity';
import { Product } from 'src/products/entities/product.entity';

@Entity()
export class BudgetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productNameSnapshot: string;

  @Column('decimal', { scale: 2, precision: 10 })
  productPriceSnapshot: number;

  @Column('decimal', { scale: 2, precision: 10 })
  totalPrice: number;

  @ManyToOne(() => Budget, (budget) => budget.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'budgetId' })
  budget: Budget;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @OneToMany(() => BudgetItemAddon, (addon) => addon.item, {
    cascade: true,
    eager: true,
  })
  addons: BudgetItemAddon[];
}
