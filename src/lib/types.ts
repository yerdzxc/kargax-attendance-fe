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
  restDay: string | null
}

export interface LeaveRecord {
  id: number
  discordUserId: string
  date: string
  type: 'SL' | 'VL' | 'EL' | 'BDL' | 'OB'
  note: string | null
}

export interface HolidayRecord {
  id: number
  date: string
  name: string
}

export interface ExportData {
  records: AttendanceRecord[]
  users: ExportUser[]
  leaves: LeaveRecord[]
  holidays: HolidayRecord[]
}

export interface AttendanceEntry {
  date: string
  dayLabel: string
  timeIn: string
  timeOut: string
  present: boolean
  status: 'present' | 'late' | 'absent' | 'restday' | 'holiday' | 'leave'
  leaveType?: string
  holidayName?: string
  overtime: boolean
  noTimeOut: boolean
}

export interface UserAttendance {
  discordId: string
  username: string
  surname: string
  givenName: string
  restDay: string | null
  days: AttendanceEntry[]
  totalPresent: number
  totalAbsent: number
}
