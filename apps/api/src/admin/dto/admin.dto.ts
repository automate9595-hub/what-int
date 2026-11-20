import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { NumberMode, SubscriptionStatus, TenantStatus } from '@prisma/client';

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

export class TenantProfileDto {
  @IsOptional() @IsString() @MaxLength(40)
  contactPhone?: string;

  @IsOptional() @IsString() @MaxLength(200)
  address?: string;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  @IsOptional() @IsString() @MaxLength(80)
  province?: string;

  @IsOptional() @IsString() @MaxLength(80)
  country?: string;

  @IsOptional() @IsString() @MaxLength(60)
  timezone?: string;
}

export class NewTenantAdminDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsEmail() @MaxLength(120)
  email!: string;

  @IsString() @MinLength(10) @MaxLength(100)
  password!: string;
}

export class NumberDto {
  @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'El número de teléfono no es válido' })
  phone!: string;

  @IsOptional() @IsString() @MaxLength(60)
  label?: string;

  @IsOptional() @IsIn([NumberMode.OWN, NumberMode.PLATFORM])
  mode?: NumberMode;
}

export class CreateTenantDto extends TenantProfileDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsString() @MaxLength(40)
  planCode!: string;

  @IsOptional() @IsInt() @Min(0) @Max(365)
  trialDays?: number;

  @ValidateNested() @Type(() => NewTenantAdminDto)
  admin!: NewTenantAdminDto;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => NumberDto)
  numbers?: NumberDto[];
}

export class UpdateTenantDto extends PartialType(TenantProfileDto) {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsUUID()
  planId?: string;

  @IsOptional() @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional() @IsISO8601()
  currentPeriodEnd?: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(10) @MaxLength(100)
  password!: string;
}
