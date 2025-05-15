import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | undefined> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.userRepo.findOne({ where: { id } });
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const hash = await bcrypt.hash('123456', 10);
    const user = this.userRepo.create({
      ...dto,
      password: hash,
      role: UserRole.VENDEDOR,
    });
    return this.userRepo.save(user);
  }

  async update(id: string, dto: CreateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    user.name = dto.name;
    user.phone = dto.phone;
    return this.userRepo.save(user);
  }
  async resetPassword(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const hash = await bcrypt.hash('123456', 10);
    user.password = hash;
    await this.userRepo.save(user);
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);

    if (!isMatch) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashed;
    await this.userRepo.save(user);
  }

  async disableSeller(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.userRepo.save({ ...user, enabled: false });
  }

  async enableSeller(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.userRepo.save({ ...user, enabled: true });
  }

  async listSellers(): Promise<User[]> {
    return this.userRepo.find({
      where: { role: UserRole.VENDEDOR },
      select: ['id', 'name', 'email', 'phone', 'enabled'],
    });
  }
}
