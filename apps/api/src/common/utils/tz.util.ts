import { BadRequestException } from '@nestjs/common';

export function assertTimezone(tz: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new BadRequestException('Zona horaria inválida');
  }
}
