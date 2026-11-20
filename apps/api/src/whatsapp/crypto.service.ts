import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** Cifrado AES-256-GCM para guardar tokens de WhatsApp. */
@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const secret = this.config.get<string>('ENCRYPTION_KEY');
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('Falta configurar ENCRYPTION_KEY (mínimo 32 caracteres) en el servidor');
    return createHash('sha256').update(secret).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
  }

  decrypt(payload: string): string {
    const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }
}
