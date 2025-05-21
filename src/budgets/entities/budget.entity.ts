import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BudgetItem } from './budget-item.entity';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerName: string;

  @Column({ nullable: true })
  customerEmail: string;

  @Column()
  customerPhone: string;

  @Column({ default: 0 })
  discountPercent: number;

  @Column({ default: false })
  requiresApproval: boolean;

  @Column({ default: true })
  issueInvoice: boolean;

  @Column({ default: false })
  approved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User;

  @Column({ default: false })
  rejected: boolean;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  rejectedBy: User;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({
    type: 'integer',
    unique: true,
    default: () => "nextval('budget_seq')",
  })
  sequentialNumber: number;

  @OneToMany(() => BudgetItem, (item) => item.budget, {
    cascade: true,
    eager: true,
  })
  items: BudgetItem[];

  @ManyToOne(() => User, (user) => user.budgets, { eager: true })
  seller: User;
}
