import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const crypto = new CryptoService({ get: () => 'x'.repeat(40) } as any);

  it('cifra y descifra', () => {
    const enc = crypto.encrypt('token-secreto');
    expect(enc).not.toContain('token-secreto');
    expect(crypto.decrypt(enc)).toBe('token-secreto');
  });

  it('falla si el texto cifrado fue alterado', () => {
    const [iv, tag, data] = crypto.encrypt('abc').split('.');
    const tampered = [iv, tag, Buffer.from('otro').toString('base64')].join('.');
    expect(() => crypto.decrypt(tampered)).toThrow();
    expect(data.length).toBeGreaterThan(0);
  });

  it('exige una clave larga', () => {
    expect(() => new CryptoService({ get: () => 'corta' } as any).encrypt('x')).toThrow();
  });
});
