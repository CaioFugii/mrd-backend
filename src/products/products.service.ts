import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Product } from './entities/product.entity';
import { Addon } from './entities/addon.entity';
import { CreateProductAddonDto } from './dto/create-product-addon.dto';
import { UpdateProductAddonDto } from './dto/update-product-addon.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Addon)
    private readonly addonRepo: Repository<Addon>,
  ) {}

  async create(dto: CreateProductDto, user: User): Promise<Product> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para criar produto.',
      );
    }

    const { addonIds, ...productData } = dto;

    const product = this.productRepo.create(productData);

    if (addonIds?.length) {
      const addons = await this.addonRepo.findBy({ id: In(addonIds) });

      if (addons.length !== addonIds.length) {
        throw new NotFoundException('Produto adicional não encontrado');
      }
      product.addons = addons;
    }

    return this.productRepo.save(product);
  }

  async findAll(options: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'price' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
    const {
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const qb = this.productRepo.createQueryBuilder('product');

    if (search) {
      qb.andWhere(
        '(LOWER(product.name) LIKE :search OR LOWER(product.description) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy(`product.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: User,
  ): Promise<Product> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar produto.',
      );
    }
    const product = await this.findOne(id);
    Object.assign(product, dto);

    const { addonIds } = dto;

    const addons = await this.addonRepo.findBy({ id: In(addonIds) });

    if (addons.length !== addonIds.length) {
      throw new NotFoundException('Produto adicional não encontrado');
    }
    product.addons = addons;
    return this.productRepo.save({ ...product, updatedAt: new Date() });
  }

  async disableProduct(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para desabilitar produto.',
      );
    }
    const product = await this.findOne(id);
    await this.productRepo.save({ ...product, enabled: false });
  }

  async createAddon(dto: CreateProductAddonDto, user: User): Promise<Addon> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para criar adicional de produto.',
      );
    }

    const productAddon = this.addonRepo.create(dto);
    return this.addonRepo.save(productAddon);
  }

  async updateAddon(id: string, dto: UpdateProductAddonDto, user: User) {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar produto adicional.',
      );
    }
    const addon = await this.findOneAddon(id);
    Object.assign(addon, dto);
    return this.addonRepo.save({ ...addon, updatedAt: new Date() });
  }

  async findAddons(options: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'price' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Addon[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const qb = this.addonRepo.createQueryBuilder('addons');

    if (search) {
      qb.andWhere(
        '(LOWER(addons.name) LIKE :search OR LOWER(addons.description) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy(`addons.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findAddonsByProduct(productId: string): Promise<Addon[]> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['addons'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product.addons;
  }

  async findOneAddon(id: string): Promise<Addon> {
    const addon = await this.addonRepo.findOne({ where: { id } });
    if (!addon) {
      throw new NotFoundException('Produto adicional não encontrado');
    }
    return addon;
  }

  async disableProductAddon(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para desabilitar um produto adicional.',
      );
    }
    const addon = await this.findOneAddon(id);
    await this.addonRepo.save({ ...addon, enabled: false });
  }
}
