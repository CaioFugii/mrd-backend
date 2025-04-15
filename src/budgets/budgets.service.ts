import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetItem } from './entities/budget-item.entity';
import { Product } from '../products/product.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { User, UserRole } from '../users/user.entity';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,

    @InjectRepository(BudgetItem)
    private readonly budgetItemRepo: Repository<BudgetItem>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(createBudgetDto: CreateBudgetDto, seller: User) {
    const { customerName, customerEmail, items, discountPercent } =
      createBudgetDto;

    const productIds = items.map((item) => item.productId);
    const products = await this.productRepo.findBy({ id: In(productIds) });

    if (products.length !== productIds.length) {
      throw new NotFoundException('Um ou mais produtos não foram encontrados.');
    }

    const budgetItems: BudgetItem[] = [];
    let subtotal = 0;

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      const totalPrice = Number(product.price) * item.quantity;
      subtotal += totalPrice;

      const budgetItem = this.budgetItemRepo.create({
        product,
        quantity: item.quantity,
        unitPrice: Number(product.price),
        totalPrice,
      });

      budgetItems.push(budgetItem);
    }

    const discount = (subtotal * discountPercent) / 100;
    const total = subtotal - discount;

    const requiresApproval = discountPercent > 5;

    const budget = this.budgetRepo.create({
      seller,
      customerName,
      customerEmail,
      discountPercent,
      total,
      requiresApproval,
      items: budgetItems,
    });

    return this.budgetRepo.save(budget);
  }

  async findAll(
    user: User,
    options: {
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    data: Budget[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, page = 1, limit = 10 } = options;

    const qb = this.budgetRepo
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('budget.seller', 'seller');

    if (search) {
      qb.andWhere('LOWER(budget.customerName) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    if (user.role !== UserRole.SUPER_USER) {
      qb.andWhere('budget.sellerId = :sellerId', { sellerId: user.id });
    }

    qb.orderBy('budget.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }
}
