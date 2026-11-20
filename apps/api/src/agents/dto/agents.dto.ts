import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAgentDto {
  @IsString() @MinLength(2) @MaxLength(60)
  name!: string;

  @IsOptional() @IsString() @MaxLength(300)
  description?: string;

  @IsOptional() @IsString() @MaxLength(500)
  personality?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  instructions?: string;

  @IsOptional() @IsIn(['es', 'en', 'pt'])
  language?: string;
}

export class UpdateAgentDto extends PartialType(CreateAgentDto) {
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
