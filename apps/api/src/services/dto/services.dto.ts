import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateServiceDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsInt() @Min(5) @Max(480)
  durationMin!: number;

  @IsOptional() @IsInt() @Min(0)
  priceCents?: number;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
