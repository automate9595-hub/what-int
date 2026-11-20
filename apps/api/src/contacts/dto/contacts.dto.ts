import { PartialType } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'El teléfono no es válido' })
  phone!: string;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}
