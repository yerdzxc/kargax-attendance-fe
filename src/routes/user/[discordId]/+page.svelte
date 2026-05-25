<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'

  interface UserRecord {
    timeIn: string | null
    timeOut: string | null
    signatureDate: string | null
    late: boolean
  }

  interface LeaveEntry {
    discordUserId: string
    date: string
    type: string
  }

  interface HolidayEntry {
    date: string
    name: string
  }

  let discordId = $derived($page.params.discordId)
  let allUsers = $state<{ discordId: string; username: string }[]>([])
  let user: { discordId: string; username: string; restDay: string | null; position: string | null } | null = $state(null)
  let records: Map<string, UserRecord> = $state(new Map())
  let leaves: Map<string, string> = $state(new Map())
  let holidays: Map<string, string> = $state(new Map())
  let dates: string[] = $state([])
  let loading = $state(true)
  let error = $state('')

  function fmt(d: Date) { return d.toISOString().split('T')[0] }

  function getMonthRange(): { from: string; to: string } {
    const today = new Date()
    return {
      from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    }
  }

  function dayLabel(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
  }

  function formatTime(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function getDateFromIso(iso: string | null): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }

  function isRestDay(dateStr: string): boolean {
    if (!user?.restDay) return false
    const restDays = user.restDay.toLowerCase().split(',').map((d) => d.trim())
    const dow = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    return restDays.includes(dow)
  }

  function isFuture(dateStr: string): boolean {
    return dateStr > fmt(new Date())
  }

  function statusClass(dateStr: string): string {
    if (isFuture(dateStr)) return 'future'
    if (holidays.has(dateStr)) return 'holiday'
    if (isRestDay(dateStr)) return 'restday'
    if (leaves.has(dateStr)) return `leave ${leaves.get(dateStr)?.toLowerCase()}`
    const rec = coveredRecords(dateStr)
    if (rec) return rec.late ? 'late' : 'present'
    return 'absent'
  }

  function statusLabel(dateStr: string): string {
    if (isFuture(dateStr)) return '—'
    if (holidays.has(dateStr)) return 'H'
    if (isRestDay(dateStr)) return 'RD'
    if (leaves.has(dateStr)) return leaves.get(dateStr)!
    const rec = coveredRecords(dateStr)
    if (rec) return rec.late ? '⚠' : 'OK'
    return '—'
  }

  function coveredRecords(dateStr: string): UserRecord | undefined {
    let rec = records.get(dateStr)
    if (rec) return rec
    for (const [sigDate, r] of records) {
      if (getDateFromIso(r.timeOut) === dateStr && sigDate !== dateStr) return r
    }
    return undefined
  }

  let monthOffset = $state(0)

  function navigateMonth(delta: number) {
    monthOffset += delta
    loadMonth()
  }

  async function loadMonth() {
    loading = true
    error = ''
    try {
      const today = new Date()
      const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
      const from = fmt(target)
      const to = fmt(new Date(target.getFullYear(), target.getMonth() + 1, 0))
      dates = []
      const d = new Date(from)
      while (d <= new Date(to)) {
        dates.push(fmt(d))
        d.setDate(d.getDate() + 1)
      }

      const [res, usersRes] = await Promise.all([
        fetch(`/api/export/user/${discordId}?from=${from}&to=${to}`),
        fetch('/api/users'),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      user = data.user
      records = new Map(data.records.map((r: UserRecord) => [r.signatureDate, r]))
      leaves = new Map(data.leaves.map((l: LeaveEntry) => [l.date, l.type]))
      holidays = new Map(data.holidays.map((h: HolidayEntry) => [h.date, h.name]))
      allUsers = await usersRes.json()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load'
    } finally {
      loading = false
    }
  }

  function switchUser(e: Event) {
    const id = (e.target as HTMLSelectElement).value
    if (id && id !== discordId) goto(`/user/${id}`)
  }

  function downloadCSV() {
    const rows: string[][] = [['Date', 'Day', 'Time In', 'Time Out', 'Status']]
    for (const date of dates) {
      const rec = coveredRecords(date) || records.get(date)
      const day = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
      const status = statusLabel(date)
      rows.push([
        date,
        day,
        rec ? formatTime(rec.timeIn) : '',
        rec ? formatTime(rec.timeOut) || '--' : '',
        holidays.has(date) ? `Holiday: ${holidays.get(date)}` : leaves.has(date) ? `Leave: ${leaves.get(date)}` : status,
      ])
    }
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${user?.username || discordId} ${dates[0]} to ${dates[dates.length - 1]}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  onMount(loadMonth)
</script>

<div class="report">
  <header class="header">
    <div>
      <a href="/" class="back-link">← Dashboard</a>
      <div class="user-switch">
        <select onchange={switchUser} value={discordId}>
          {#each allUsers as u}
            <option value={u.discordId}>{u.username || u.discordId}</option>
          {/each}
        </select>
      </div>
      {#if user?.position}
        <span class="position-tag">{user.position}</span>
      {/if}
    </div>
    <div class="month-nav">
      <button class="nav-btn" onclick={() => navigateMonth(-1)}>← Prev</button>
      <span class="month-label">
        {new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </span>
      <button class="nav-btn" onclick={() => navigateMonth(1)} disabled={monthOffset >= 0}>Next →</button>
    </div>
    <button class="btn-download" onclick={downloadCSV} title="Download CSV">⬇ CSV</button>
  </header>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Time In</th>
            <th>Time Out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each dates as date}
            {@const rec = coveredRecords(date)}
            <tr class="day-row {statusClass(date)}">
              <td class="date-cell">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
              <td class="day-cell">{dayLabel(date)}</td>
              <td class="time-cell">
                {#if rec}
                  {formatTime(rec.timeIn)}
                {:else if !isFuture(date)}
                  <span class="absent-marker">—</span>
                {/if}
              </td>
              <td class="time-cell">
                {#if rec}
                  {formatTime(rec.timeOut) || '--'}
                {:else if !isFuture(date)}
                  <span class="absent-marker">—</span>
                {/if}
              </td>
              <td class={`status-cell ${statusClass(date)}`}>{statusLabel(date)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .report { max-width: 700px; margin: 0 auto; padding: 24px 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 4px 0 0; }
  .back-link { font-size: 13px; color: #5865f2; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }
  .user-switch { margin: 6px 0; }
  .user-switch select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-weight: 600; min-width: 200px; }
  .position-tag { display: inline-block; font-size: 11px; background: #e0e7ff; color: #4f46e5; padding: 2px 8px; border-radius: 4px; margin-top: 4px; }
  .month-nav { display: flex; align-items: center; gap: 10px; }
  .nav-btn { padding: 4px 12px; border: 1px solid #ddd; border-radius: 6px; background: white; font-size: 12px; cursor: pointer; }
  .nav-btn:hover:not(:disabled) { border-color: #5865f2; color: #5865f2; }
  .nav-btn:disabled { opacity: 0.4; cursor: default; }
  .month-label { font-size: 14px; font-weight: 600; color: #333; min-width: 140px; text-align: center; }
  .btn-download { padding: 6px 14px; border: 1px solid #22c55e; border-radius: 6px; background: white; font-size: 12px; color: #22c55e; cursor: pointer; }
  .btn-download:hover { background: #22c55e; color: white; }
  .loading, .error { padding: 48px; text-align: center; color: #888; font-size: 14px; }
  .error { color: #dc2626; }
  .table-scroll { overflow-x: auto; background: white; border-radius: 10px; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f8f9fa; padding: 10px 12px; font-weight: 600; color: #555; text-align: left; border-bottom: 2px solid #eee; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  .day-row:hover td { background: #f8f9fa; }
  .day-row.present td { background: #f0fdf4; }
  .day-row.late td { background: #fffbeb; }
  .day-row.absent td { background: #fef2f2; }
  .day-row.restday td { background: #eef2ff; }
  .day-row.holiday td { background: #fdf2f8; }
  .day-row.future td { color: #ccc; }
  .day-row.leave td { background: #fafafa; }
  .date-cell { font-weight: 500; color: #333; }
  .day-cell { color: #888; font-size: 12px; }
  .time-cell { font-variant-numeric: tabular-nums; }
  .absent-marker { color: #ccc; }
  .status-cell { display: flex; align-items: center; gap: 6px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.3px; }
  .badge-present { background: #dcfce7; color: #16a34a; }
  .badge-absent { background: #fef2f2; color: #dc2626; }
  .badge-late { background: #fef3c7; color: #d97706; }
  .badge-restday { background: #e0e7ff; color: #4f46e5; }
  .badge-holiday { background: #fce7f3; color: #db2777; }
  .badge-future { background: #f5f5f5; color: #bbb; }
  .badge-leave { background: #f5f5f5; color: #616161; }
  .badge-sl { background: #fce4ec; color: #c62828; }
  .badge-vl { background: #e8f5e9; color: #2e7d32; }
  .badge-el { background: #fff3e0; color: #e65100; }
  .badge-bdl { background: #e3f2fd; color: #1565c0; }
  .badge-ob { background: #f3e5f5; color: #7b1fa2; }
  .holiday-name { font-size: 11px; color: #db2777; }
</style>
