import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User, UserRole } from 'src/users/user.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto, user: User): Promise<Product> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para criar produto.',
      );
    }
    const product = this.productRepo.create(dto);
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
    return this.productRepo.save({ ...product, updatedAt: new Date() });
  }

  async delete(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.SUPER_USER) {
      throw new ForbiddenException(
        'Você não tem permissão para deletar produto.',
      );
    }
    const product = await this.findOne(id);
    await this.productRepo.remove(product);
  }
}
