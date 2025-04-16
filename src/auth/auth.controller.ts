import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User, UserRole } from 'src/users/user.entity';
import { Roles, RolesGuard } from 'src/shared/guard/roles.guard';
import { JwtAuthGuard } from 'src/shared/guard/jwt-auth.guard';
import { UpdatePasswordDto } from 'src/users/dto/update-password.dto';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_USER)
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-password')
  updatePassword(@CurrentUser() user: User, @Body() dto: UpdatePasswordDto) {
    return this.authService.updatePassword(user.id, dto);
  }
}
