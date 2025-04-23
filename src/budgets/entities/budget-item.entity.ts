import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  OneToMany,
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
  unitPriceSnapshot: number;

  @Column('decimal', { scale: 2, precision: 10 })
  totalPrice: number;

  @ManyToOne(() => Budget, (budget) => budget.items, {
    onDelete: 'CASCADE',
  })
  budget: Budget;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @OneToMany(() => BudgetItemAddon, (addon) => addon.item, {
    cascade: true,
    eager: true,
  })
  addons: BudgetItemAddon[];
}
