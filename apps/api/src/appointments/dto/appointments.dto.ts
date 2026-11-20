import { AppointmentStatus } from '@prisma/client';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  contactId!: string;

  @IsUUID()
  serviceId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;

  @IsOptional() @IsIn([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
  status?: AppointmentStatus;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsISO8601()
  startsAt?: string;

  @IsOptional() @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
