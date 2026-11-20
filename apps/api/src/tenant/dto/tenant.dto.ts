import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TenantProfileDto } from '../../admin/dto/admin.dto';

export class UpdateMyTenantDto extends PartialType(TenantProfileDto) {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;
}
