import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { BudgetItem } from './budget-item.entity';
import { Addon } from '../../products/entities/addon.entity';

@Entity('budget_item_addons')
export class BudgetItemAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nameSnapshot: string;

  @Column('decimal', { precision: 10, scale: 2 })
  priceSnapshot: number;

  @ManyToOne(() => BudgetItem, (item) => item.addons, {
    onDelete: 'CASCADE',
  })
  item: BudgetItem;

  @ManyToOne(() => Addon, { eager: true })
  productAddon: Addon;
}
