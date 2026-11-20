import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AdminService } from './admin.service';
import { UpdatePlanDto, UpdateTenantStatusDto } from './dto/admin.dto';

const cap = (n: number, max: number) => Math.min(Math.max(n, 0), max);

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('tenants')
  listTenants(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listTenants(cap(limit, 100) || 50, cap(offset, 100000));
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getTenant(id);
  }

  @Patch('tenants/:id/status')
  setStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.admin.setTenantStatus(user, id, dto.status);
  }

  @Get('plans')
  listPlans() {
    return this.admin.listPlans();
  }

  @Patch('plans/:id')
  updatePlan(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(user, id, dto);
  }

  @Get('audit-logs')
  auditLogs(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.admin.auditLogs(cap(limit, 200) || 50);
  }
}
