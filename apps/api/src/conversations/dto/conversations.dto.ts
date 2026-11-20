import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  text!: string;
}

export class UpdateConversationDto {
  @IsOptional() @IsBoolean()
  aiPaused?: boolean;

  @IsOptional() @IsBoolean()
  needsHuman?: boolean;

  @IsOptional() @IsIn(['OPEN', 'CLOSED'])
  status?: 'OPEN' | 'CLOSED';

  @IsOptional() @IsUUID()
  assignedUserId?: string | null;
}
