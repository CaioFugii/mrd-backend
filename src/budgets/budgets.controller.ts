import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
  Patch,
  Put,
  Delete,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { JwtAuthGuard } from 'src/shared/guard/jwt-auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Roles, RolesGuard } from 'src/shared/guard/roles.guard';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { Budget } from './entities/budget.entity';
import { UpdateBudgetDetailsDto } from './dto/update-details-budget.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateAddonsDto } from './dto/update-addons.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  async create(
    @Body() createBudgetDto: CreateBudgetDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.budgetsService.create(createBudgetDto, user);
    return this.mapperBudget(data);
  }

  @Put('/:id/details')
  async updateDetails(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDetailsDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.budgetsService.updateDetails(id, dto, user);
    return this.mapperBudget(data);
  }

  @Delete('/:id/items/:productId')
  async deleteItem(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: User,
  ) {
    await this.budgetsService.deleteItem(id, productId, user);
  }

  @Post('/:id/items')
  async addItem(
    @Param('id') id: string,
    @Body() addItemDto: AddItemDto,
    @CurrentUser() user: User,
  ) {
    const budget = await this.budgetsService.addItem(id, addItemDto, user);
    return budget.items;
  }

  @Put('/:id/addons')
  async updateAddons(
    @Param('id') id: string,
    @Body() updateAddonsDto: UpdateAddonsDto,
    @CurrentUser() user: User,
  ) {
    const budget = await this.budgetsService.updateAddons(
      id,
      updateAddonsDto,
      user,
    );
    return budget.items;
  }

  @Get()
  async findAll(@CurrentUser() user: User, @Query() query: BudgetQueryDto) {
    const result = await this.budgetsService.findAll(user, query);

    return { ...result, data: result.data?.map(this.mapperBudget) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.budgetsService.findOne(id, user);

    return this.mapperBudget(result);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_USER)
  async approveBudget(@Param('id') id: string, @CurrentUser() user: User) {
    await this.budgetsService.approve(id, user);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_USER)
  async rejectBudget(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: User,
  ) {
    await this.budgetsService.reject(id, reason, user);
  }

  @Patch(':id/sell')
  @UseGuards(JwtAuthGuard)
  async sellBudget(@Param('id') id: string, @CurrentUser() user: User) {
    await this.budgetsService.sellBudget(id, user);
  }

  private mapperBudget(data: Budget) {
    return {
      sequentialNumber: data.sequentialNumber,
      id: data.id,
      customerName: data.customerName,
      status: data.status,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      discountPercent: data.discountPercent,
      commissionPercent: data.commissionPercent,
      requiresApproval: data.requiresApproval,
      issueInvoice: data.issueInvoice,
      approved: data.approved,
      approvedAt: data.approvedAt,
      rejected: data.rejected,
      rejectedAt: data.rejectedAt,
      rejectionReason: data.rejectionReason,
      total: data.total,
      createdAt: data.createdAt,
      items: data.items?.map((item) => ({
        id: item.id,
        productNameSnapshot: item.productNameSnapshot,
        productPriceSnapshot: item.productPriceSnapshot,
        totalPrice: item.totalPrice,
        productId: item.product.id,
        addons: item.addons?.map((addon) => ({
          id: addon.id,
          addonNameSnapshot: addon.addonNameSnapshot,
          addonPriceSnapshot: addon.addonPriceSnapshot,
          quantity: addon.quantity,
          totalPrice: addon.totalPrice,
          addonId: addon.addon.id,
        })),
      })),
      seller: {
        name: data.seller.name,
        email: data.seller.email,
        phone: data.seller.phone,
      },
    };
  }
}
