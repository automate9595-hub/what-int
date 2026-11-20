import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ConversationsService } from './conversations.service';
import { SendMessageDto, UpdateConversationDto } from './dto/conversations.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@Roles(UserRole.TENANT_ADMIN, UserRole.OPERATOR)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string, @Query('status') status?: string) { return this.conversations.list(user, q, status); }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.conversations.get(user, id); }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) { return this.conversations.send(user, id, dto.text); }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) { return this.conversations.update(user, id, dto); }
}
