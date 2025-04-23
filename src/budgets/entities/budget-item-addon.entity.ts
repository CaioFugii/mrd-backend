import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BudgetItem } from './budget-item.entity';
import { Addon } from 'src/products/entities/addon.entity';

@Entity('budget_item_addons')
export class BudgetItemAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  addonNameSnapshot: string;

  @Column('decimal', { precision: 10, scale: 2 })
  addonPriceSnapshot: number;

  @Column('int', { default: 1 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @ManyToOne(() => BudgetItem, (item) => item.addons, {
    onDelete: 'CASCADE',
  })
  item: BudgetItem;

  @ManyToOne(() => Addon, { eager: true })
  addon: Addon;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
