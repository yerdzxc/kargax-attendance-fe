export interface AttendanceRecord {
  discordUserId: string
  username: string
  timeIn: string | null
  timeOut: string | null
  signatureDate: string | null
}

export interface ExportUser {
  discordId: string
  username: string
}

export interface ExportData {
  records: AttendanceRecord[]
  users: ExportUser[]
}

export interface AttendanceEntry {
  date: string
  dayLabel: string
  timeIn: string
  timeOut: string
  present: boolean
}

export interface UserAttendance {
  discordId: string
  username: string
  surname: string
  givenName: string
  days: AttendanceEntry[]
  totalPresent: number
  totalAbsent: number
}
