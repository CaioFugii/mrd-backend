import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetItem } from './entities/budget-item.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { User, UserRole } from '../users/user.entity';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { MAX_DISCOUNT } from 'src/shared/constants';
import { Product } from 'src/products/entities/product.entity';
import { BudgetItemAddon } from './entities/budget-item-addon.entity';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,

    @InjectRepository(BudgetItem)
    private readonly budgetItemRepo: Repository<BudgetItem>,

    @InjectRepository(BudgetItemAddon)
    private readonly budgetItemAddonRepo: Repository<BudgetItemAddon>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(createDto: CreateBudgetDto, user: User): Promise<Budget> {
    if (!createDto.items.length) {
      throw new BadRequestException('Este orçamento precisa possuir itens.');
    }

    const budgetInsertResult = await this.budgetRepo.insert({
      customerName: createDto.customerName,
      customerEmail: createDto.customerEmail,
      customerPhone: createDto.customerPhone,
      requiresApproval: (createDto.discountPercent || 0) > MAX_DISCOUNT,
      discountPercent: createDto.discountPercent || 0,
      approved: (createDto.discountPercent || 0) <= MAX_DISCOUNT,
      approvedAt:
        (createDto.discountPercent || 0) <= MAX_DISCOUNT ? new Date() : null,
      seller: { id: user.id },
      approvedBy: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rejected: false,
      total: 0,
    });

    const budgetId = budgetInsertResult.identifiers[0].id;

    const budget = await this.budgetRepo.findOneByOrFail({ id: budgetId });

    const items: BudgetItem[] = [];

    for (const itemDto of createDto.items) {
      const product = await this.productRepo.findOneOrFail({
        where: { id: itemDto.productId },
        relations: ['addons'],
      });

      const unitPrice = Number(product.price);
      const quantity = itemDto.quantity;

      const item = this.budgetItemRepo.create({
        product,
        productNameSnapshot: product.name,
        unitPriceSnapshot: unitPrice,
        quantity,
        totalPrice: 0,
        budget,
        addons: [],
      });

      let addonsTotal = 0;

      if (itemDto.addonIds?.length) {
        const selectedAddons = product.addons.filter((addon) =>
          itemDto.addonIds.includes(addon.id),
        );

        item.addons = selectedAddons.map((addon) => {
          addonsTotal += Number(addon.price);
          return this.budgetItemAddonRepo.create({
            nameSnapshot: addon.name,
            priceSnapshot: Number(addon.price),
            productAddon: addon,
            item,
          });
        });
      }

      item.totalPrice = (unitPrice + addonsTotal) * quantity;

      items.push(item);
    }

    await this.budgetItemRepo.insert(items);

    const total = this.calculateTotal(items, budget.discountPercent || 0);

    await this.budgetRepo.update(budget.id, { total });

    return this.budgetRepo.findOneOrFail({
      where: { id: budget.id },
      relations: ['items'],
    });
  }

  private calculateTotal(items: BudgetItem[], discountPercent: number) {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );
    const discount = subtotal * (discountPercent / 100);
    return subtotal - discount;
  }

  async findAll(
    user: User,
    query: BudgetQueryDto,
  ): Promise<{ data: Budget[]; total: number; page: number; limit: number }> {
    const qb = this.budgetRepo
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.seller', 'seller')
      .leftJoinAndSelect('budget.items', 'items')
      .leftJoinAndSelect('items.product', 'product');

    if (user.role !== UserRole.SUPER_USER) {
      qb.where('seller.id = :sellerId', { sellerId: user.id });
    }

    if (query.customerName) {
      qb.andWhere('LOWER(budget.customerName) LIKE :customerName', {
        customerName: `%${query.customerName.toLowerCase()}%`,
      });
    }

    if (query.onlyApproved) {
      qb.andWhere('budget.approved = true');
    }

    if (query.onlyPendingApproval) {
      qb.andWhere('budget.requiresApproval = true AND budget.approved = false');
    }

    qb.orderBy('budget.createdAt', query.orderBy || 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 10;

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string, user: User): Promise<Budget> {
    const budget = await this.budgetRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'seller'],
    });

    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado.');
    }

    if (user.role !== UserRole.SUPER_USER && budget.seller.id !== user.id) {
      throw new BadRequestException(
        'Você não tem permissão para acessar orçamento.',
      );
    }

    return budget;
  }

  async approve(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para aprovar orçamento.',
      );
    }

    const budget = await this.budgetRepo.findOne({
      where: { id },
    });

    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado.');
    }

    if (!budget.requiresApproval) {
      throw new BadRequestException('Este orçamento não requer aprovação.');
    }

    if (budget.approved) {
      throw new BadRequestException('Este orçamento já foi aprovado.');
    }

    budget.approved = true;
    budget.approvedAt = new Date();
    budget.approvedBy = user;

    await this.budgetRepo.save(budget);
  }

  async reject(id: string, reason: string, user: User): Promise<void> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para rejeitar orçamento.',
      );
    }

    if (!reason) {
      throw new BadRequestException('Forneça um motivo da rejeição.');
    }

    const budget = await this.budgetRepo.findOne({
      where: { id },
      relations: ['rejectedBy'],
    });

    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado.');
    }

    if (!budget.requiresApproval) {
      throw new BadRequestException('Este orçamento não requer aprovação.');
    }

    if (budget.approved) {
      throw new BadRequestException('Orçamento já foi aprovado.');
    }

    if (budget.rejected) {
      throw new BadRequestException('Orçamento já foi rejeitado.');
    }

    budget.rejected = true;
    budget.rejectedAt = new Date();
    budget.rejectedBy = user;
    budget.rejectionReason = reason;

    await this.budgetRepo.save(budget);
  }
}
