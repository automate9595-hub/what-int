import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

const ASSIGNABLE = [UserRole.OPERATOR, UserRole.TENANT_ADMIN];

export class CreateUserDto {
  @IsEmail() @MaxLength(120)
  email!: string;

  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsString() @MinLength(10) @MaxLength(100)
  password!: string;

  @IsIn(ASSIGNABLE)
  role!: UserRole;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @IsOptional() @IsIn(ASSIGNABLE)
  role?: UserRole;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
