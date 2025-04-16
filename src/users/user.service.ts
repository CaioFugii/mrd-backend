import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from './user.entity';
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

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);

    if (!isMatch) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashed;
    await this.userRepo.save(user);
  }
}
