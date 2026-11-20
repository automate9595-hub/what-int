const dtfCache = new Map<string, Intl.DateTimeFormat>();

function parts(date: Date, tz: string) {
  let dtf = dtfCache.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    dtfCache.set(tz, dtf);
  }
  return Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value])) as Record<string, string>;
}

function offsetMinutes(date: Date, tz: string): number {
  const p = parts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - date.getTime()) / 60000;
}

/** Fecha local "YYYY-MM-DD" + minutos desde medianoche local -> instante UTC. */
export function localToUtc(dateStr: string, minutes: number, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  return new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
}

/** Instante UTC -> fecha y minutos locales en la zona horaria. */
export function utcToLocal(date: Date, tz: string): { dateStr: string; minutes: number } {
  const p = parts(date, tz);
  return { dateStr: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
}

/** Día de la semana de una fecha de calendario (0 = domingo). */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
