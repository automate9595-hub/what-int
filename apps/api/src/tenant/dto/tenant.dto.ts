import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMyTenantDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;
}
