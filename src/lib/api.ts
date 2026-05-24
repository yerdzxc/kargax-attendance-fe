import type { ExportData, LeaveRecord, HolidayRecord } from '$lib/types'

const BASE = '/api'

export async function fetchAttendance(from: string, to: string, type: string): Promise<ExportData> {
  const res = await fetch(`${BASE}/export/data?from=${from}&to=${to}&type=${type}`)
  if (!res.ok) throw new Error('Failed to fetch attendance data')
  return res.json()
}

export async function setName(discordId: string, username: string): Promise<void> {
  await fetch(`${BASE}/set-name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId, username }),
  })
}

export async function setRestDay(discordId: string, restDay: string | null): Promise<void> {
  await fetch(`${BASE}/set-rest-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId, restDay }),
  })
}

export async function listHolidays(): Promise<HolidayRecord[]> {
  const res = await fetch(`${BASE}/holidays`)
  if (!res.ok) throw new Error('Failed to fetch holidays')
  return res.json()
}

export async function upsertHoliday(date: string, name: string): Promise<void> {
  await fetch(`${BASE}/holidays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, name }),
  })
}

export async function removeHoliday(date: string): Promise<void> {
  await fetch(`${BASE}/holidays?date=${date}`, { method: 'DELETE' })
}

export async function listLeaves(from?: string, to?: string): Promise<LeaveRecord[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const res = await fetch(`${BASE}/leaves?${params}`)
  if (!res.ok) throw new Error('Failed to fetch leaves')
  return res.json()
}

export async function upsertLeave(discordId: string, date: string, type: string, note?: string): Promise<void> {
  await fetch(`${BASE}/leaves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId, date, type, note }),
  })
}

export async function removeLeave(discordId: string, date: string): Promise<void> {
  await fetch(`${BASE}/leaves?discordId=${discordId}&date=${date}`, { method: 'DELETE' })
}

export function generateDates(from: string, to: string): string[] {
  const dates: string[] = []
  const current = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

export function getWeekRange(): { from: string; to: string } {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(monday), to: fmt(sunday) }
}
