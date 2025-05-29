import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Budget, BudgetStatus } from './entities/budget.entity';
import { BudgetItem } from './entities/budget-item.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { MAX_COMMISSION, MAX_DISCOUNT } from 'src/shared/constants';
import { Product } from 'src/products/entities/product.entity';
import { BudgetItemAddon } from './entities/budget-item-addon.entity';
import { UpdateBudgetDetailsDto } from './dto/update-details-budget.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateAddonsDto } from './dto/update-addons.dto';

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

    if (query.search) {
      const isNumeric = !isNaN(Number(query.search));
      if (isNumeric) {
        qb.andWhere(
          'budget.sequentialNumber = :searchNumber OR LOWER(budget.customerName) LIKE :searchText',
          {
            searchNumber: Number(query.search),
            searchText: `%${String(query.search).toLowerCase()}%`,
          },
        );
      } else {
        qb.andWhere('LOWER(budget.customerName) LIKE :searchText', {
          searchText: `%${String(query.search).toLowerCase()}%`,
        });
      }
    }

    if (query.onlyPendingApproval) {
      qb.andWhere('budget.requiresApproval = true AND budget.approved = false');
    }

    if (query.onlySold) {
      qb.andWhere(`budget.status = '${BudgetStatus.VENDIDO}'`);
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

    budget.status = BudgetStatus.APROVADO;
    budget.requiresApproval = false;
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

    budget.status = BudgetStatus.REJEITADO;
    budget.requiresApproval = true;
    budget.rejected = true;
    budget.rejectedAt = new Date();
    budget.rejectedBy = user;
    budget.rejectionReason = reason;

    await this.budgetRepo.save(budget);
  }

  async sellBudget(id: string, user: User): Promise<void> {
    const budget = await this.budgetRepo.findOne({
      where: { id },
    });

    if (user.id !== budget.seller.id && user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para editar o status deste orçamento.',
      );
    }

    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado.');
    }

    if (budget.requiresApproval) {
      throw new BadRequestException('Este orçamento requer aprovação.');
    }

    if (budget.rejected) {
      throw new BadRequestException('Este orçamento está rejeitado.');
    }

    budget.status = BudgetStatus.VENDIDO;

    await this.budgetRepo.save(budget);
  }

  private calculateTotalItems(items: BudgetItem[], discountPercent: number) {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );
    const discount = subtotal * (discountPercent / 100);
    return subtotal - discount;
  }

  private calculateIssueInvoicePercent(total: number, enable: boolean) {
    if (enable) {
      const issueInvoicePercent =
        Number(process.env.ISSUE_INVOICE_PERCENT) ?? 0;
      const issueInvoiceValue = (total * issueInvoicePercent) / 100;

      return total + issueInvoiceValue;
    }

    return total;
  }

  private calculateCommissionPercent(total: number, commissionPercent: number) {
    const totalWithCommission = (total * commissionPercent) / 100;

    return total + totalWithCommission;
  }

  private calculateBudgetTotal(
    items: BudgetItem[],
    discountPercent: number,
    commissionPercent: number,
    issueInvoice: boolean,
  ) {
    const totalWithDiscount = this.calculateTotalItems(items, discountPercent);

    const totalWithCommission = this.calculateCommissionPercent(
      totalWithDiscount,
      commissionPercent,
    );

    return this.calculateIssueInvoicePercent(totalWithCommission, issueInvoice);
  }

  async create(createDto: CreateBudgetDto, user: User): Promise<Budget> {
    if (!createDto.items.length) {
      throw new BadRequestException('Este orçamento precisa possuir itens.');
    }

    if (createDto.commissionPercent > MAX_COMMISSION) {
      throw new BadRequestException(
        'Comissão do vendedor acima do valor permitido',
      );
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

      budget.total = this.calculateBudgetTotal(
        budgetItems,
        discountPercent,
        budget.commissionPercent,
        budget.issueInvoice,
      );

      await budgetRepo.save(budget);

      return budgetRepo.findOneOrFail({
        where: { id: budget.id },
        relations: ['items', 'items.addons'],
      });
    });
  }

  async updateDetails(
    id: string,
    dto: UpdateBudgetDetailsDto,
    user: User,
  ): Promise<Budget> {
    const budget = await this.budgetRepo.findOneOrFail({
      where: { id },
      relations: ['seller'],
    });

    if (budget.seller.id !== user.id && user.role !== UserRole.SUPER_USER) {
      throw new UnauthorizedException();
    }

    budget.customerName = dto.customerName;
    budget.customerEmail = dto.customerEmail || null;
    budget.customerPhone = dto.customerPhone;
    budget.discountPercent = dto.discountPercent;

    budget.requiresApproval = dto.discountPercent > MAX_DISCOUNT;
    budget.approved = !budget.requiresApproval;
    budget.approvedAt = budget.approved ? new Date() : null;
    budget.approvedBy = null;
    budget.rejected = false;
    budget.rejectedAt = null;
    budget.rejectedBy = null;
    budget.rejectionReason = null;

    budget.total = this.calculateBudgetTotal(
      budget.items,
      budget.discountPercent,
      budget.commissionPercent,
      budget.issueInvoice,
    );

    await this.budgetRepo.save(budget);
    return budget;
  }

  async deleteItem(id: string, productId: string, user: User): Promise<Budget> {
    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const itemRepo = manager.getRepository(BudgetItem);

      const budget = await budgetRepo.findOneOrFail({
        where: { id },
        relations: ['seller', 'items', 'items.addons'],
      });

      if (budget.seller.id !== user.id && user.role !== UserRole.SUPER_USER) {
        throw new UnauthorizedException();
      }

      await itemRepo.delete({ id: productId });

      const newBudget = await budgetRepo.findOneOrFail({
        where: { id },
        relations: ['items', 'items.addons'],
      });

      newBudget.total = this.calculateBudgetTotal(
        newBudget.items,
        newBudget.discountPercent,
        newBudget.commissionPercent,
        newBudget.issueInvoice,
      );

      return await budgetRepo.save(newBudget);
    });
  }

  async addItem(id: string, addItemDto: AddItemDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const budgetItemRepo = manager.getRepository(BudgetItem);
      const budgetItemAddonRepo = manager.getRepository(BudgetItemAddon);
      const productRepo = manager.getRepository(Product);

      const budget = await budgetRepo.findOneOrFail({
        where: { id },
        relations: ['seller', 'items', 'items.addons'],
      });

      if (budget.seller.id !== user.id && user.role !== UserRole.SUPER_USER) {
        throw new UnauthorizedException();
      }

      const products = await this.fetchProductsWithAddonsTransactional(
        [addItemDto.item.productId],
        productRepo,
      );

      const budgetItems = this.buildBudgetItems(
        [addItemDto.item],
        products,
        budget,
        budgetItemRepo,
      );

      await budgetItemRepo.save(budgetItems);
      const allItemAddons = this.buildItemAddons(
        [addItemDto.item],
        budgetItems,
        products,
        budgetItemAddonRepo,
      );

      await budgetItemRepo.save(budgetItems);
      await budgetItemAddonRepo.save(allItemAddons);

      const newBudget = await budgetRepo.findOneOrFail({
        where: { id },
        relations: ['items', 'items.addons'],
      });

      newBudget.total = this.calculateBudgetTotal(
        newBudget.items,
        newBudget.discountPercent,
        newBudget.commissionPercent,
        newBudget.issueInvoice,
      );

      return await budgetRepo.save(newBudget);
    });
  }

  async updateAddons(id: string, updateAddonsDto: UpdateAddonsDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const budgetItemRepo = manager.getRepository(BudgetItem);
      const budgetItemAddonRepo = manager.getRepository(BudgetItemAddon);
      const productRepo = manager.getRepository(Product);

      const budget = await budgetRepo.findOneOrFail({
        where: { id },
        relations: ['seller', 'items', 'items.addons'],
      });

      if (budget.seller.id !== user.id && user.role !== UserRole.SUPER_USER) {
        throw new UnauthorizedException();
      }

      await budgetItemAddonRepo.delete({
        item: { id: updateAddonsDto.budgetItemId },
      });

      const products = await this.fetchProductsWithAddonsTransactional(
        [updateAddonsDto.productId],
        productRepo,
      );

      const budgetItem = await budgetItemRepo.findOne({
        where: { id: updateAddonsDto.budgetItemId },
      });

      const allItemAddons = this.buildItemAddons(
        [
          {
            productId: updateAddonsDto.productId,
            addons: updateAddonsDto.addons,
          },
        ],
        [budgetItem],
        products,
        budgetItemAddonRepo,
      );

      const totalPriceAddons = allItemAddons.reduce(
        (acc, current) => acc + current.totalPrice,
        0,
      );

      budgetItem.totalPrice =
        Number(budgetItem.product.price) + totalPriceAddons;

      await budgetItemRepo.save(budgetItem);
      await budgetItemAddonRepo.save(allItemAddons);

      const newBudget = await budgetRepo.findOneOrFail({
        where: { id },
        relations: ['items', 'items.addons'],
      });

      newBudget.total = this.calculateBudgetTotal(
        newBudget.items,
        newBudget.discountPercent,
        newBudget.commissionPercent,
        newBudget.issueInvoice,
      );

      return await budgetRepo.save(newBudget);
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
    const status = requiresApproval
      ? BudgetStatus.PENDENTE
      : BudgetStatus.APROVADO;

    const budget = budgetRepo.create({
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      issueInvoice: dto.issueInvoice,
      requiresApproval,
      discountPercent,
      commissionPercent: dto.commissionPercent,
      approved,
      status,
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
      const newBudgetItem = budgetItemRepo.create({
        product,
        productNameSnapshot: product.name,
        productPriceSnapshot: productPrice,
        totalPrice: 0,
        budget,
        addons: [],
      });
      return newBudgetItem;
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
