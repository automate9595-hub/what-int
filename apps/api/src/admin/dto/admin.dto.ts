import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MaxLength(60)
  name?: string;

  @IsOptional() @IsInt() @Min(0)
  priceCents?: number;

  @IsOptional() @IsObject()
  limits?: Record<string, number>;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
