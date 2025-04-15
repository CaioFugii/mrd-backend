import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { BudgetItem } from './budget-item.entity';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.budgets, { eager: true })
  seller: User;

  @Column()
  customerName: string;

  @Column()
  customerEmail: string;

  @Column({ default: 0 })
  discountPercent: number;

  @Column({ default: false })
  requiresApproval: boolean;

  @OneToMany(() => BudgetItem, (item) => item.budget, {
    cascade: true,
    eager: true,
  })
  items: BudgetItem[];

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
