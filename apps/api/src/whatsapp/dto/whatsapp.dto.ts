import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnectNumberDto {
  @Matches(/^\d{5,30}$/, { message: 'El Phone Number ID debe tener solo dígitos' })
  phoneNumberId!: string;

  @IsOptional() @Matches(/^\d{5,30}$/, { message: 'El ID de la cuenta de WhatsApp (WABA) debe tener solo dígitos' })
  wabaId?: string;

  @IsString() @MinLength(20) @MaxLength(1000)
  accessToken!: string;
}
