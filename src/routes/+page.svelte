<script lang="ts">
  import { onMount } from 'svelte';
  import type { UserAttendance, AttendanceEntry, ExportData } from '$lib/types';
  import { fetchAttendance, generateDates, getWeekRange } from '$lib/api';
  import SummaryCards from '$lib/components/SummaryCards.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import AttendanceTable from '$lib/components/AttendanceTable.svelte';

  let users: UserAttendance[] = $state([]);
  let filteredUsers: UserAttendance[] = $state([]);
  let dates: string[] = $state([]);
  let dateMeta = $state(new Map<string, { dayOfWeek: string; dayLabel: string; display: string }>());
  let loading = $state(true);

  let from = $state('');
  let to = $state('');
  let type = $state('employee');
  let search = $state('');
  let error = $state('');

  let showAbsent = $state(false);
  let viewMode = $state<'weekly' | 'monthly'>('weekly');
  let statusFilter = $state('all');
  let positionFilter = $state('all');

  let uniquePositions: string[] = $derived(
    [...new Set(users.map((u) => u.position).filter(Boolean))]
  );

  function buildDateMeta(dateList: string[]) {
    const meta = new Map<string, { dayOfWeek: string; dayLabel: string; display: string }>()
    for (const date of dateList) {
      const d = new Date(date + 'T00:00:00')
      meta.set(date, {
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long' }),
        dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
        display: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      })
    }
    return meta
  }

  function parseTime(iso: string | null): { h: number; m: number } | null {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return { h: d.getHours(), m: d.getMinutes() }
  }

  function formatTime(iso: string | null): string {
    const t = parseTime(iso)
    if (!t) return ''
    return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`
  }

  function getDateFromIso(iso: string | null): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }

  function isOvertime(iso: string | null, timeInIso?: string | null): boolean {
    const out = parseTime(iso)
    if (!out) return false
    const tin = timeInIso ? parseTime(timeInIso) : null
    if (tin && tin.h >= 14) { return out.h < 9 || (out.h === 9 && out.m === 0) }
    return out.h > 18 || (out.h === 18 && out.m > 0)
  }

  function parseName(username: string): { surname: string; givenName: string } {
    const commaIdx = username.indexOf(',')
    if (commaIdx > -1) {
      return { surname: username.substring(0, commaIdx).trim(), givenName: username.substring(commaIdx + 1).trim() }
    }
    const spaceIdx = username.lastIndexOf(' ')
    if (spaceIdx > -1) {
      return { surname: username.substring(spaceIdx + 1).trim(), givenName: username.substring(0, spaceIdx).trim() }
    }
    return { surname: '', givenName: username }
  }

  function processExportData(data: ExportData, dateList: string[], metaMap: Map<string, { dayOfWeek: string; dayLabel: string; display: string }>): UserAttendance[] {
    const leaveMap = new Map<string, Map<string, string>>()
    for (const l of data.leaves) {
      if (!leaveMap.has(l.discordUserId)) leaveMap.set(l.discordUserId, new Map())
      leaveMap.get(l.discordUserId)!.set(l.date, l.type)
    }

    const holidaySet = new Set<string>()
    const holidayNames = new Map<string, string>()
    for (const h of data.holidays) {
      holidaySet.add(h.date)
      holidayNames.set(h.date, h.name)
    }

    const recordMap = new Map<string, Map<string, { timeIn: string | null; timeOut: string | null; late: boolean }>>()
    for (const r of data.records) {
      if (!r.signatureDate) continue
      if (!recordMap.has(r.discordUserId)) recordMap.set(r.discordUserId, new Map())
      recordMap.get(r.discordUserId)!.set(r.signatureDate, { timeIn: r.timeIn, timeOut: r.timeOut, late: r.late })
    }

    return data.users.map((u) => {
      const userRecords = recordMap.get(u.discordId) || new Map()
      const userLeaves = leaveMap.get(u.discordId) || new Map()
      const { surname, givenName } = parseName(u.username)
      const restDays = u.restDay?.toLowerCase().split(',').map((d) => d.trim()) || []

      const coveredDates = new Map<string, { timeIn: string | null; timeOut: string | null; late: boolean }>()
      for (const [date, rec] of userRecords) {
        coveredDates.set(date, rec)
        const tod = getDateFromIso(rec.timeOut)
        if (tod && tod !== date) coveredDates.set(tod, rec)
      }

      let totalPresent = 0
      let totalAbsent = 0

      const days: AttendanceEntry[] = dateList.map((date) => {
        const rec = coveredDates.get(date)
        const m = metaMap.get(date)!
        const isRestDay = restDays.includes(m.dayOfWeek.toLowerCase())
        const isHoliday = holidaySet.has(date)
        const leaveType = userLeaves.get(date)
        const isFuture = date > new Date().toISOString().split('T')[0]

        let present = false
        let status: AttendanceEntry['status'] = 'absent'

        if (leaveType) {
          status = 'leave'
        } else if (isHoliday) {
          status = 'holiday'
        } else if (isRestDay) {
          status = 'restday'
        } else if (isFuture) {
          status = 'future'
        } else if (rec) {
          present = true
          status = rec.late ? 'late' : 'present'
        }

        if (present) totalPresent++
        else if (status === 'absent') totalAbsent++

        return {
          date,
          dayLabel: m.dayLabel,
          timeIn: formatTime(rec?.timeIn),
          timeOut: formatTime(rec?.timeOut),
          present,
          status,
          leaveType,
          holidayName: isHoliday ? holidayNames.get(date) : undefined,
          overtime: rec ? isOvertime(rec.timeOut, rec.timeIn) : false,
          noTimeOut: rec ? !rec.timeOut : false,
        }
      })

      return { discordId: u.discordId, username: u.username, surname, givenName, restDay: u.restDay, position: u.position, days, totalPresent, totalAbsent }
    })
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const raw = await fetchAttendance(from, to, type) as ExportData;
      const dateList = generateDates(from, to);
      const meta = buildDateMeta(dateList);
      dateMeta = meta;
      dates = dateList;
      users = processExportData(raw, dateList, meta);
      filteredUsers = filterUsers(users, search, positionFilter);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
      users = []; filteredUsers = []; dates = [];
    } finally {
      loading = false;
    }
  }

  function setWeekly() {
    viewMode = 'weekly'
    const range = getWeekRange()
    from = range.from; to = range.to; load()
  }

  function setMonthly() {
    viewMode = 'monthly'
    const today = new Date()
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    from = first.toISOString().split('T')[0]; to = last.toISOString().split('T')[0]; load()
  }

  function filterUsers(userList: UserAttendance[], query: string, position: string): UserAttendance[] {
    let list = userList
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((u) => u.username.toLowerCase().includes(q) || u.givenName.toLowerCase().includes(q) || u.surname.toLowerCase().includes(q))
    }
    if (position && position !== 'all') {
      list = list.filter((u) => u.position === position)
    }
    return list
  }

  function handleSearch(v: string) { search = v; filteredUsers = filterUsers(users, v, positionFilter) }
  function handlePositionFilter(v: string) { positionFilter = v; filteredUsers = filterUsers(users, search, v) }

  function handleTypeChange(v: string) { type = v; load() }

  function handleDateChange(f: string, t: string) { from = f; to = t; load() }

  function handlePreset(preset: string) {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()
    const d = today.getDate()
    const dayOfWeek = today.getDay()
    const fmt = (dt: Date) => dt.toISOString().split('T')[0]

    if (preset === 'prev-week') {
      const prev = new Date(from)
      prev.setDate(prev.getDate() - 7)
      const next = new Date(to)
      next.setDate(next.getDate() - 7)
      from = fmt(prev); to = fmt(next)
    } else if (preset === 'next-week') {
      const prev = new Date(from)
      prev.setDate(prev.getDate() + 7)
      const next = new Date(to)
      next.setDate(next.getDate() + 7)
      from = fmt(prev); to = fmt(next)
    } else if (preset === 'this-week') {
      const monday = new Date(today)
      monday.setDate(d - ((dayOfWeek + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      from = fmt(monday); to = fmt(sunday)
    } else if (preset === 'last-week') {
      const monday = new Date(today)
      monday.setDate(d - ((dayOfWeek + 6) % 7) - 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      from = fmt(monday); to = fmt(sunday)
    } else if (preset === 'this-month') {
      from = fmt(new Date(y, m, 1))
      to = fmt(new Date(y, m + 1, 0))
    }
    load()
  }

  function handleDownload() {
    const rows: string[][] = []
    const h1: string[] = ['NAMES', '']
    const h2: string[] = ['SURNAME', 'GIVEN NAME']
    const hr: string[] = ['', '']

    for (let i = 0; i < dates.length; i++) {
      h1.push(dateMeta.get(dates[i])!.display, '')
      h2.push('Time in', 'Time out')
      hr.push(dateMeta.get(dates[i])!.dayOfWeek, '')
    }
    rows.push(h1, h2, hr)

    for (const u of users) {
      const row: string[] = [u.surname, u.givenName || u.username]
      for (const day of u.days) {
        row.push(day.timeIn, day.timeOut)
      }
      rows.push(row)
    }

    const csv = '\uFEFF' + rows.map((r) => r.map((c) => c.includes(',') || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `KargaX Attendance ${dates[0]} to ${dates[dates.length - 1]}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const displayedUsers = $derived(
    statusFilter === 'all' ? filteredUsers
    : statusFilter === 'absent' ? filteredUsers.filter((u) => u.days.some((d) => d.status === 'absent'))
    : filteredUsers.filter((u) => u.days.some((d) => d.status === statusFilter))
  )

  const todayIdx = $derived(dates.indexOf(new Date().toISOString().split('T')[0]))
  const todayPresent = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.present).length : 0);
  const todayAbsent = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.status === 'absent').length : 0);
  const todayLeave = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.status === 'leave').length : 0);
  const todayRest = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.status === 'restday').length : 0);
  const todayHoliday = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.status === 'holiday').length : 0);
  const todayLate = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.status === 'late').length : 0);
  const todayOT = $derived(todayIdx >= 0 ? users.filter((u) => u.days[todayIdx]?.overtime).length : 0);

  const absentUsers = $derived(
    displayedUsers
      .filter((u) => u.days.some((d) => d.status === 'absent'))
      .map((u) => ({
        ...u,
        absentDates: u.days.filter((d) => d.status === 'absent').map((d) => d.date),
      })),
  );

  onMount(() => {
    const range = getWeekRange();
    from = range.from;
    to = range.to;
    load();
  });
</script>

<div class="app">
  <header class="header">
    <div>
      <h1>Attendance Dashboard</h1>
      <p class="subtitle">KargaX — View and export attendance records</p>
    </div>
    <div class="header-actions">
      <div class="view-toggle">
        <button class="toggle-btn" class:active={viewMode === 'weekly'} onclick={setWeekly}>Week</button>
        <button class="toggle-btn" class:active={viewMode === 'monthly'} onclick={setMonthly}>Month</button>
      </div>
      <a href="/manage" class="manage-link">Manage</a>
    </div>
  </header>

  <main class="main">
    {#if error}
      <div class="error-banner">
        <span>{error}</span>
        <button onclick={load}>Retry</button>
      </div>
    {/if}

    <SummaryCards
      totalUsers={users.length}
      totalPresent={todayPresent}
      totalAbsent={todayAbsent}
      totalLeave={todayLeave}
      totalRest={todayRest}
      totalHoliday={todayHoliday}
      totalLate={todayLate}
      totalOT={todayOT}
    />

    <FilterBar
      {from} {to} {type} {search} {loading}
      onSearch={handleSearch}
      onTypeChange={handleTypeChange}
      onDateChange={handleDateChange}
      onPreset={handlePreset}
      onDownload={handleDownload}
      onRefresh={load}
    />

    <details class="legend">
      <summary>Badge Legend</summary>
      <div class="legend-items">
        <span class="legend-item"><span class="badge badge-present">OK</span> Present</span>
        <span class="legend-item"><span class="badge badge-late">Late</span> Late</span>
        <span class="legend-item"><span class="badge badge-absent">—</span> Absent</span>
        <span class="legend-item"><span class="badge badge-rest">RD</span> Rest Day</span>
        <span class="legend-item"><span class="badge badge-holiday">H</span> Holiday</span>
        <span class="legend-item"><span class="badge badge-sl">SL</span> Sick Leave</span>
        <span class="legend-item"><span class="badge badge-vl">VL</span> Vacation Leave</span>
        <span class="legend-item"><span class="badge badge-el">EL</span> Emergency Leave</span>
        <span class="legend-item"><span class="badge badge-bdl">BDL</span> Birthday Leave</span>
        <span class="legend-item"><span class="badge badge-ob">OB</span> Official Business</span>
        <span class="legend-item"><span class="ot-icon">+</span> Overtime</span>
        <span class="legend-item"><span class="late-icon">⚠</span> Late (manually set by HR)</span>
      </div>
      <div class="legend-notes">
        <strong>OT indicator (+):</strong> day shift (>6PM) / night shift (>6AM if clock-in ≥2PM) — <em>visual hint only, not official OT</em><br>
        <strong>Day-spanning:</strong> night shifts covering the next day won't show as absent
      </div>
    </details>

    <div class="table-section">
      <div class="section-header">
        <h2>Attendance Table</h2>
        <div class="table-actions">
          <select class="status-filter" bind:value={statusFilter}>
            <option value="all">All</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="leave">On Leave</option>
            <option value="restday">Rest Day</option>
            <option value="holiday">Holiday</option>
          </select>
          <select class="status-filter" bind:value={positionFilter} onchange={(e) => handlePositionFilter((e.target as HTMLSelectElement).value)}>
            <option value="all">All Roles</option>
            {#each uniquePositions as pos}
              <option value={pos}>{pos}</option>
            {/each}
          </select>
          <button class="toggle-absent" onclick={() => showAbsent = !showAbsent}>
            {showAbsent ? 'Show All' : 'Absent List'} ({absentUsers.length})
          </button>
        </div>
      </div>

      {#if showAbsent}
        <div class="absent-list">
          <h3>Employees with Absences</h3>
          {#if absentUsers.length === 0}
            <div class="empty">No absences this period.</div>
          {:else}
            {#each absentUsers as u}
              <div class="absent-item">
                <span class="absent-name">{u.givenName || u.username} {u.surname}</span>
                <span class="absent-dates">{u.absentDates.join(', ')}</span>
              </div>
            {/each}
          {/if}
        </div>
      {/if}

      <AttendanceTable users={displayedUsers} {dates} {loading} />
    </div>
  </main>

  <footer class="footer">
    <span>KargaX Attendance System</span>
  </footer>
</div>

<style>
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; min-height: 100vh; }
  .app { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .header h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  .subtitle { font-size: 13px; color: #888; margin-top: 2px; }
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .view-toggle { display: flex; gap: 0; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
  .toggle-btn { padding: 6px 14px; border: none; background: white; font-size: 12px; font-weight: 600; color: #888; cursor: pointer; }
  .toggle-btn.active { background: #5865f2; color: white; }
  .manage-link { padding: 6px 14px; background: white; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-weight: 600; color: #5865f2; text-decoration: none; }
  .manage-link:hover { background: #f0f4ff; }
  .main { min-height: 60vh; }
  .error-banner { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #b91c1c; font-size: 13px; margin-bottom: 16px; }
  .error-banner button { padding: 6px 12px; background: #b91c1c; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
  .error-banner button:hover { background: #991b1b; }
  .table-section { margin-top: 20px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .section-header h2 { font-size: 16px; color: #333; }
  .table-actions { display: flex; align-items: center; gap: 8px; }
  .status-filter { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; background: white; }
  .toggle-absent { padding: 6px 12px; background: white; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; font-weight: 600; color: #5865f2; cursor: pointer; }
  .toggle-absent:hover { background: #f0f4ff; }
  .absent-list { background: white; border: 1px solid #fee2e2; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .absent-list h3 { font-size: 14px; color: #b91c1c; margin-bottom: 12px; }
  .empty { padding: 24px; text-align: center; color: #aaa; font-size: 13px; }
  .absent-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .absent-item:last-child { border-bottom: none; }
  .absent-name { font-weight: 500; color: #333; }
  .absent-dates { color: #888; font-size: 12px; }
  .footer { text-align: center; padding: 32px 0 16px; font-size: 11px; color: #aaa; }
  .legend { background: white; border: 1px solid #eee; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; cursor: pointer; }
  .legend summary { font-weight: 600; color: #555; }
  .legend-items { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; cursor: default; }
  .legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #666; }
  .legend-item .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .legend-item .badge-present { background: #dcfce7; color: #16a34a; }
  .legend-item .badge-late { background: #fef3c7; color: #d97706; }
  .legend-item .badge-absent { background: #fef2f2; color: #dc2626; }
  .legend-item .badge-rest { background: #e0e7ff; color: #4f46e5; }
  .legend-item .badge-holiday { background: #fce7f3; color: #db2777; }
  .legend-item .badge-sl { background: #fce4ec; color: #c62828; }
  .legend-item .badge-vl { background: #e8f5e9; color: #2e7d32; }
  .legend-item .badge-el { background: #fff3e0; color: #e65100; }
  .legend-item .badge-bdl { background: #e3f2fd; color: #1565c0; }
  .legend-item .badge-ob { background: #f3e5f5; color: #7b1fa2; }
  .legend-item .ot-icon { color: #22c55e; font-weight: 700; font-size: 14px; }
  .legend-item .late-icon { color: #f59e0b; font-size: 14px; }
  .legend-notes { margin-top: 10px; font-size: 11px; color: #888; line-height: 1.6; padding-top: 8px; border-top: 1px solid #eee; }
</style>
