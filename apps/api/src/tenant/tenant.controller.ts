import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { UpdateMyTenantDto } from './dto/tenant.dto';
import { TenantService } from './tenant.service';

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Roles(UserRole.TENANT_ADMIN, UserRole.OPERATOR)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.tenant.me(user);
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMyTenantDto) {
    return this.tenant.update(user, dto);
  }
}
