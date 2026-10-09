import { addDays } from '../utils/format';

// Resolve each local midnight separately, including offsets that change at DST.
export function localMidnight(date: string, timezone: string) {
  const desired = Date.parse(`${date}T00:00:00Z`);
  let instant = desired;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const correction = desired - wall;
    if (!correction) return new Date(instant).toISOString();
    instant += correction;
  }
  throw new Error('Não foi possível resolver a data no fuso da barbearia.');
}
export function appointmentDateRange(from: string | undefined, to: string | undefined, timezone: string) {
  return { from: from ? localMidnight(from, timezone) : undefined, until: to ? localMidnight(addDays(to, 1), timezone) : undefined };
}
