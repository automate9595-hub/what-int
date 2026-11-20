import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class HourDto {
  @IsInt() @Min(0) @Max(6)
  dayOfWeek!: number;

  @IsInt() @Min(0) @Max(1439)
  startMin!: number;

  @IsInt() @Min(1) @Max(1440)
  endMin!: number;
}

export class SetHoursDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => HourDto)
  hours!: HourDto[];
}

export class CreateBlockDto {
  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional() @IsString() @MaxLength(200)
  reason?: string;
}
