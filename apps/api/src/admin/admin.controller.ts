import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ConnectNumberDto } from '../whatsapp/dto/whatsapp.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AdminService } from './admin.service';
import { CreateTenantDto, NumberDto, ResetPasswordDto, UpdatePlanDto, UpdateSubscriptionDto, UpdateTenantDto, UpdateTenantStatusDto } from './dto/admin.dto';

const cap = (n: number, max: number) => Math.min(Math.max(n, 0), max);

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly wa: WhatsappService) {}

  @Get('tenants')
  listTenants(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listTenants(cap(limit, 100) || 50, cap(offset, 100000));
  }

  @Post('tenants')
  createTenant(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantDto) { return this.admin.createTenant(user, dto); }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseUUIDPipe) id: string) { return this.admin.getTenant(id); }

  @Patch('tenants/:id')
  updateTenant(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) { return this.admin.updateTenant(user, id, dto); }

  @Patch('tenants/:id/status')
  setStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.admin.setTenantStatus(user, id, dto.status);
  }

  @Patch('tenants/:id/subscription')
  updateSubscription(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.admin.updateSubscription(user, id, dto);
  }

  @Post('tenants/:id/numbers')
  addNumber(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NumberDto) { return this.admin.addNumber(user, id, dto); }

  @Delete('numbers/:id')
  removeNumber(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.admin.removeNumber(user, id); }

  @Post('numbers/:id/connect')
  connectNumber(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConnectNumberDto) { return this.wa.connectNumber(user, id, dto); }

  @Post('numbers/:id/disconnect')
  disconnectNumber(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.wa.disconnectNumber(user, id); }

  @Post('users/:id/password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto) {
    return this.admin.resetPassword(user, id, dto.password);
  }

  @Get('plans')
  listPlans() { return this.admin.listPlans(); }

  @Patch('plans/:id')
  updatePlan(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) { return this.admin.updatePlan(user, id, dto); }

  @Get('audit-logs')
  auditLogs(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) { return this.admin.auditLogs(cap(limit, 200) || 50); }
}
