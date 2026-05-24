import type { UserAttendance, AttendanceEntry } from './types';

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWeekRange(): { from: string; to: string } {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: fmt(monday), to: fmt(sunday) };
}

function parseUsername(username: string): { surname: string; givenName: string } {
  const commaIdx = username.indexOf(',');
  if (commaIdx > -1) {
    return { surname: username.substring(0, commaIdx).trim(), givenName: username.substring(commaIdx + 1).trim() };
  }
  const spaceIdx = username.indexOf(' ');
  if (spaceIdx > -1) {
    return { surname: username.substring(0, spaceIdx).trim(), givenName: username.substring(spaceIdx + 1).trim() };
  }
  return { surname: '', givenName: username };
}

export function generateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (current <= end) {
    dates.push(fmt(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export async function fetchAttendance(
  from?: string,
  to?: string,
  type: string = 'employee',
): Promise<UserAttendance[]> {
  const range = getWeekRange();
  const fromDate = from || range.from;
  const toDate = to || range.to;

  const params = new URLSearchParams({ from: fromDate, to: toDate, type });
  const res = await fetch(`/api/export/data?${params}`);
  if (!res.ok) throw new Error('Failed to fetch attendance data');
  const data = await res.json() as { records: any[]; users: any[] };

  const dates = generateDates(fromDate, toDate);
  const recordMap = new Map<string, Map<string, { timeIn: string; timeOut: string }>>();
  for (const r of data.records) {
    if (!recordMap.has(r.discordUserId)) {
      recordMap.set(r.discordUserId, new Map());
    }
    const userDates = recordMap.get(r.discordUserId)!;
    const dateKey = r.signatureDate || '';
    const timeIn = r.timeIn
      ? new Date(r.timeIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';
    const timeOut = r.timeOut
      ? new Date(r.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';
    userDates.set(dateKey, { timeIn, timeOut });
  }

  return data.users.map((user: any) => {
    const { surname, givenName } = parseUsername(user.username);
    const userDates = recordMap.get(user.discordId) || new Map();
    const days: AttendanceEntry[] = dates.map((date) => {
      const entry = userDates.get(date);
      return { date, dayLabel: dayLabel(date), timeIn: entry?.timeIn || '', timeOut: entry?.timeOut || '', present: !!entry };
    });
    const totalPresent = days.filter((d) => d.present).length;
    const totalAbsent = dates.length - totalPresent;
    return { discordId: user.discordId, username: user.username, surname, givenName, days, totalPresent, totalAbsent };
  });
}

export { getWeekRange };
