import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@Roles(UserRole.TENANT_ADMIN, UserRole.OPERATOR)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string) { return this.contacts.list(user, q); }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.contacts.get(user, id); }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContactDto) { return this.contacts.create(user, dto); }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto) { return this.contacts.update(user, id, dto); }
}
