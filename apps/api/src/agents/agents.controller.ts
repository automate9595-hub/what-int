import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agents.dto';

@ApiTags('agents')
@ApiBearerAuth()
@Roles(UserRole.TENANT_ADMIN, UserRole.OPERATOR)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) { return this.agents.list(user); }

  @Roles(UserRole.TENANT_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAgentDto) { return this.agents.create(user, dto); }

  @Roles(UserRole.TENANT_ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAgentDto) { return this.agents.update(user, id, dto); }
}
