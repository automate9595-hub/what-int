import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateBlockDto, SetHoursDto } from './dto/scheduling.dto';
import { SchedulingService } from './scheduling.service';

@ApiTags('schedule')
@ApiBearerAuth()
@Roles(UserRole.TENANT_ADMIN, UserRole.OPERATOR)
@Controller('schedule')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('hours')
  hours(@CurrentUser() user: AuthUser) { return this.scheduling.getHours(user); }

  @Roles(UserRole.TENANT_ADMIN)
  @Put('hours')
  setHours(@CurrentUser() user: AuthUser, @Body() dto: SetHoursDto) { return this.scheduling.setHours(user, dto.hours); }

  @Get('blocks')
  blocks(@CurrentUser() user: AuthUser) { return this.scheduling.listBlocks(user); }

  @Post('blocks')
  createBlock(@CurrentUser() user: AuthUser, @Body() dto: CreateBlockDto) { return this.scheduling.createBlock(user, dto); }

  @Delete('blocks/:id')
  deleteBlock(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.scheduling.deleteBlock(user, id); }

  @Get('availability')
  availability(@CurrentUser() user: AuthUser, @Query('date') date: string, @Query('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.scheduling.availability(user, String(date ?? ''), serviceId);
  }
}
