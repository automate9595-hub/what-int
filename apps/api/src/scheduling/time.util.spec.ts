import { dayOfWeek, isValidDate, localToUtc, utcToLocal } from './time.util';

const TZ = 'America/Argentina/Buenos_Aires';

describe('time.util', () => {
  it('convierte hora local de Buenos Aires (UTC-3) a UTC', () => {
    expect(localToUtc('2026-11-20', 9 * 60, TZ).toISOString()).toBe('2026-11-20T12:00:00.000Z');
  });
  it('convierte de UTC a hora local', () => {
    expect(utcToLocal(new Date('2026-11-20T02:30:00.000Z'), TZ)).toEqual({ dateStr: '2026-11-19', minutes: 23 * 60 + 30 });
  });
  it('calcula el día de la semana', () => {
    expect(dayOfWeek('2026-11-20')).toBe(5);
  });
  it('valida fechas', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-11-20')).toBe(true);
  });
});
