import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetItem } from './entities/budget-item.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { MAX_DISCOUNT } from 'src/shared/constants';
import { Product } from 'src/products/entities/product.entity';
import { BudgetItemAddon } from './entities/budget-item-addon.entity';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,

    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    user: User,
    query: BudgetQueryDto,
  ): Promise<{ data: Budget[]; total: number; page: number; limit: number }> {
    const qb = this.budgetRepo
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.seller', 'seller')
      .leftJoinAndSelect('budget.items', 'items')
      .leftJoinAndSelect('items.addons', 'addons')
      .leftJoinAndSelect('addons.addon', 'addon')
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
      relations: [
        'items',
        'items.product',
        'items.addons',
        'items.addons.addon',
        'seller',
      ],
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

  private calculateTotal(items: BudgetItem[], discountPercent: number) {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );
    const discount = subtotal * (discountPercent / 100);
    return subtotal - discount;
  }

  async create(createDto: CreateBudgetDto, user: User): Promise<Budget> {
    if (!createDto.items.length) {
      throw new BadRequestException('Este orçamento precisa possuir itens.');
    }

    const discountPercent = createDto.discountPercent || 0;
    const requiresApproval = discountPercent > MAX_DISCOUNT;
    const approved = !requiresApproval;

    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const budgetItemRepo = manager.getRepository(BudgetItem);
      const budgetItemAddonRepo = manager.getRepository(BudgetItemAddon);
      const productRepo = manager.getRepository(Product);

      const budget = await this.createInitialBudgetTransactional(
        createDto,
        user,
        requiresApproval,
        approved,
        discountPercent,
        budgetRepo,
      );

      const products = await this.fetchProductsWithAddonsTransactional(
        createDto.items.map((i) => i.productId),
        productRepo,
      );

      const budgetItems = this.buildBudgetItems(
        createDto.items,
        products,
        budget,
        budgetItemRepo,
      );

      await budgetItemRepo.save(budgetItems);

      const allItemAddons = this.buildItemAddons(
        createDto.items,
        budgetItems,
        products,
        budgetItemAddonRepo,
      );

      await budgetItemRepo.save(budgetItems);
      await budgetItemAddonRepo.save(allItemAddons);

      const total = this.calculateTotal(budgetItems, discountPercent);
      budget.total = total;
      await budgetRepo.save(budget);

      return budgetRepo.findOneOrFail({
        where: { id: budget.id },
        relations: ['items', 'items.addons'],
      });
    });
  }

  private async createInitialBudgetTransactional(
    dto: CreateBudgetDto,
    user: User,
    requiresApproval: boolean,
    approved: boolean,
    discountPercent: number,
    budgetRepo: Repository<Budget>,
  ): Promise<Budget> {
    const budget = budgetRepo.create({
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      requiresApproval,
      discountPercent,
      approved,
      approvedAt: approved ? new Date() : null,
      seller: { id: user.id },
      approvedBy: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rejected: false,
      total: 0,
    });

    return budgetRepo.save(budget);
  }

  private async fetchProductsWithAddonsTransactional(
    productIds: string[],
    productRepo: Repository<Product>,
  ): Promise<Map<string, Product>> {
    const products = await productRepo.find({
      where: { id: In(productIds), enabled: true },
      relations: ['addons'],
    });
    return new Map(products.map((p) => [p.id, p]));
  }

  private buildBudgetItems(
    itemsDto: CreateBudgetDto['items'],
    productMap: Map<string, Product>,
    budget: Budget,
    budgetItemRepo: Repository<BudgetItem>,
  ): BudgetItem[] {
    return itemsDto.map((itemDto) => {
      const product = productMap.get(itemDto.productId);
      if (!product) {
        throw new BadRequestException(
          `Produto com ID ${itemDto.productId} não encontrado.`,
        );
      }

      const productPrice = Number(product.price);

      return budgetItemRepo.create({
        product,
        productNameSnapshot: product.name,
        productPriceSnapshot: productPrice,
        totalPrice: 0,
        budget,
        addons: [],
      });
    });
  }

  private buildItemAddons(
    itemsDto: CreateBudgetDto['items'],
    budgetItems: BudgetItem[],
    productMap: Map<string, Product>,
    budgetItemAddonRepo: Repository<BudgetItemAddon>,
  ): BudgetItemAddon[] {
    const allItemAddons: BudgetItemAddon[] = [];

    for (let i = 0; i < itemsDto.length; i++) {
      const itemDto = itemsDto[i];
      const item = budgetItems[i];
      const product = productMap.get(itemDto.productId)!;

      const enabledAddons = new Map(
        product.addons.filter((a) => a.enabled).map((a) => [a.id, a]),
      );
      let itemTotal = Number(product.price);

      for (const addonInput of itemDto.addons || []) {
        const addon = enabledAddons.get(addonInput.id);
        if (!addon) {
          throw new BadRequestException(
            `Produto adicional com ID ${addonInput.id} inválido ou desativado.`,
          );
        }

        const quantity = addonInput.quantity || 1;
        const addonPrice = Number(addon.price);
        const addonTotal = addonPrice * quantity;

        const budgetAddon = budgetItemAddonRepo.create({
          addonNameSnapshot: addon.name,
          addonPriceSnapshot: addonPrice,
          addon,
          quantity,
          totalPrice: addonTotal,
          item,
        });

        itemTotal += addonTotal;
        allItemAddons.push(budgetAddon);
      }

      item.totalPrice = itemTotal;
    }

    return allItemAddons;
  }
}
