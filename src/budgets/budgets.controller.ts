import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { JwtAuthGuard } from 'src/shared/guard/jwt-auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { User } from 'src/users/user.entity';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  async create(
    @Body() createBudgetDto: CreateBudgetDto,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.create(createBudgetDto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.budgetsService.findAll(user, {
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }
}
