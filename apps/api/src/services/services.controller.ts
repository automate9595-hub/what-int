import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Roles(UserRole.TENANT_ADMIN, UserRole.OPERATOR)
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) { return this.services.list(user); }

  @Roles(UserRole.TENANT_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) { return this.services.create(user, dto); }

  @Roles(UserRole.TENANT_ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) { return this.services.update(user, id, dto); }
}
