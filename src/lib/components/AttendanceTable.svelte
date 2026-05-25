<script lang="ts">
  import type { UserAttendance } from '$lib/types'

  let {
    users,
    dates,
    loading,
  }: { users: UserAttendance[]; dates: string[]; loading: boolean } = $props()

  let editing: string | null = $state(null)
  let editValue = $state('')

  let timeEdit: { userId: string; date: string; timeIn: string; timeOut: string; late: boolean } | null = $state(null)

  const today = $derived(new Date().toISOString().split('T')[0])

  function dayLabel(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function isWeekend(dateStr: string): boolean {
    return new Date(dateStr + 'T00:00:00').getDay() % 6 === 0
  }

  function isToday(dateStr: string): boolean {
    return dateStr === today
  }

  function startEdit(id: string, current: string) {
    editing = id
    editValue = current
  }

  async function saveEdit(id: string) {
    if (!editValue.trim()) { editing = null; return }
    try {
      const res = await fetch('/api/set-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: id, username: editValue.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const user = users.find((u) => u.discordId === id)
      if (user) {
        user.username = editValue.trim()
        const nameParts = parseName(editValue.trim())
        user.surname = nameParts.surname
        user.givenName = nameParts.givenName
      }
    } catch {
      // ignore
    } finally {
      editing = null
    }
  }

  function cancelEdit() { editing = null }

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

  function handleKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') saveEdit(id)
    if (e.key === 'Escape') cancelEdit()
  }

  function startTimeEdit(userId: string, date: string, timeIn: string, timeOut: string, late: boolean) {
    timeEdit = { userId, date, timeIn, timeOut, late }
  }

  async function saveTimeEdit() {
    if (!timeEdit) return
    const { userId, date, timeIn, timeOut, late } = timeEdit

    if (timeIn.trim() && timeOut.trim()) {
      const [ih, im] = timeIn.split(':').map(Number)
      const [oh, om] = timeOut.split(':').map(Number)
      if (oh < ih || (oh === ih && om <= im)) {
        if (!confirm(`Time out (${timeOut}) is before or same as time in (${timeIn}). Save anyway?`)) return
      }
    }

    try {
      const body: any = { discordUserId: userId, signatureDate: date, late }
      if (timeIn.trim()) body.timeIn = timeIn.trim()
      if (timeOut.trim()) body.timeOut = timeOut.trim()
      const res = await fetch('/api/correct-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      const user = users.find((u) => u.discordId === userId)
      if (user) {
        const day = user.days.find((d) => d.date === date)
        if (day) {
          day.timeIn = timeIn.trim()
          day.timeOut = timeOut.trim()
          day.status = late ? 'late' : 'present'
        }
      }
    } catch {
      // ignore
    } finally {
      timeEdit = null
    }
  }

  function cancelTimeEdit() { timeEdit = null }

  function handleTimeKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveTimeEdit()
    if (e.key === 'Escape') cancelTimeEdit()
  }

  function statusBadge(day: UserAttendance['days'][number]) {
    if (day.status === 'future') return { cls: 'badge-future', label: '' }
    if (day.status === 'restday') return { cls: 'badge-rest', label: 'RD' }
    if (day.status === 'holiday') return { cls: 'badge-holiday', label: 'H' }
    if (day.status === 'leave') return { cls: `badge-${day.leaveType?.toLowerCase() || 'leave'}`, label: day.leaveType || 'L' }
    if (day.status === 'late') return { cls: 'badge-late', label: 'Late' }
    if (day.present) return { cls: 'badge-present', label: 'OK' }
    return { cls: 'badge-absent', label: '—' }
  }

  function isTimeEditing(userId: string, date: string): boolean {
    return timeEdit !== null && timeEdit.userId === userId && timeEdit.date === date
  }
</script>

<div class="table-wrapper">
  {#if loading}
    <div class="loading">Loading attendance data...</div>
  {:else if users.length === 0}
    <div class="empty">No records found for the selected period.</div>
  {:else}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="name">Name <span class="hint">(dbl-click)</span></th>
            {#each dates as date}
              <th class="date" class:weekend={isWeekend(date)} class:today-hl={isToday(date)}>
                <span class="day">{dayLabel(date)}</span>
                <span class="date-num">{formatDate(date)}</span>
              </th>
            {/each}
            <th class="summary-col pres">Pres.</th>
            <th class="summary-col abs">Abs.</th>
          </tr>
        </thead>
        <tbody>
          {#each users as user, i}
            <tr class={i % 2 === 0 ? 'even' : 'odd'}>
              <td class="name-cell" ondblclick={() => startEdit(user.discordId, user.username)}>
                {#if editing === user.discordId}
                  <input
                    type="text"
                    class="name-input"
                    bind:value={editValue}
                    onblur={() => saveEdit(user.discordId)}
                    onkeydown={(e) => handleKeydown(e, user.discordId)}
                    autofocus
                  />
                {:else}
                  <span class="given">{user.givenName || user.username}</span>
                <a href={`/user/${user.discordId}`} class="report-link" title="View report">📋</a>
                  {#if user.surname}
                    <span class="surname">{user.surname}</span>
                  {/if}
                  {#if user.position}
                    <span class="position">{user.position}</span>
                  {/if}
                  {#if user.restDay}
                    <span class="restday-tag">RD: {user.restDay}</span>
                  {/if}
                {/if}
              </td>
              {#each user.days as day}
                {@const badge = statusBadge(day)}
                <td
                  class="day-cell"
                  class:weekend={isWeekend(day.date)}
                  class:today-hl={isToday(day.date)}
                  class:future={day.status === 'future'}
                >
                  {#if day.status === 'future'}
                    <span class="day-future">—</span>
                  {:else if day.present || day.status === 'late'}
                    {#if isTimeEditing(user.discordId, day.date)}
                      <div class="time-edit-popup">
                        <div class="time-edit-row">
                          <input type="text" class="time-input" bind:value={timeEdit!.timeIn} placeholder="In" autofocus />
                          <span class="time-sep">→</span>
                          <input type="text" class="time-input" bind:value={timeEdit!.timeOut} placeholder="Out" />
                        </div>
                        <label class="late-label"><input type="checkbox" bind:checked={timeEdit!.late} /> Late</label>
                        <div class="time-edit-actions">
                          <button class="btn-edit primary" onclick={saveTimeEdit}>Save</button>
                          <button class="btn-edit" onclick={cancelTimeEdit}>Cancel</button>
                        </div>
                      </div>
                    {:else}
                      <span class="time-display" ondblclick={() => startTimeEdit(user.discordId, day.date, day.timeIn, day.timeOut, day.status === 'late')} title="Double-click to edit">
                        <span class="time-in">{day.timeIn || '--'}</span>
                        <span class="time-arrow">→</span>
                        <span class="time-out">{day.timeOut || '--'}</span>
                        {#if day.timeOut && day.expectedTimeOut}
                          <span class="time-exp">({day.expectedTimeOut})</span>
                        {/if}
                        {#if day.status === 'late'}
                          <span class="late-icon" title="Late">⚠</span>
                        {/if}
                        {#if day.overtime}
                          <span class="ot-icon" title="Overtime">+</span>
                        {/if}
                        {#if day.earlyLeave}
                          <span class="early-icon" title="Left early">⌛</span>
                        {/if}
                      </span>
                    {/if}
                  {:else}
                    <span class="badge {badge.cls}">{badge.label}</span>
                  {/if}
                </td>
              {/each}
              <td class="stat-cell pres">{user.totalPresent}</td>
              <td class="stat-cell abs">{user.totalAbsent}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .table-wrapper { background: var(--bg-card); border-radius: 10px; box-shadow: var(--shadow); border: 1px solid var(--border); }
  .table-scroll { overflow-x: auto; }
  .loading, .empty { padding: 48px 24px; text-align: center; color: var(--text-secondary); font-size: 14px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; min-width: 500px; }
  thead { position: sticky; top: 0; z-index: 2; }
  th { background: var(--table-stripe); padding: 8px 6px; font-weight: 600; color: var(--text-secondary); text-align: center; border-bottom: 2px solid var(--border); white-space: nowrap; }
  th.name { text-align: left; padding-left: 16px; min-width: 200px; position: sticky; left: 0; background: var(--table-stripe); z-index: 3; }
  th.weekend { background: var(--bg-hover); }
  th.today-hl { background: #e8f0fe; border-bottom-color: #5865f2; }
  th.today-hl .date-num { color: #5865f2; font-weight: 800; }
  .hint { font-weight: 400; font-size: 10px; color: var(--text-muted); }
  .date .day { display: block; font-size: 10px; color: var(--text-secondary); }
  .date .date-num { font-size: 11px; color: var(--text-primary); }
  td { padding: 6px 4px; text-align: center; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .name-cell { text-align: left; padding-left: 16px; position: sticky; left: 0; background: inherit; z-index: 0; cursor: pointer; }
  .name-cell:hover .given { color: #5865f2; }
  .given { display: inline; font-weight: 500; color: var(--text-primary); font-size: 13px; }
  .surname { font-size: 11px; color: var(--text-secondary); margin-left: 4px; }
  .report-link { text-decoration: none; font-size: 11px; margin-left: 4px; opacity: 0.4; }
  .report-link:hover { opacity: 1; }
  .restday-tag { display: inline-block; font-size: 9px; background: var(--bg-hover); color: var(--text-secondary); padding: 1px 5px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
  .position { display: block; font-size: 10px; color: var(--text-secondary); font-weight: 400; }
  .name-input { width: 100%; padding: 4px 6px; border: 2px solid #5865f2; border-radius: 4px; font-size: 13px; font-weight: 500; outline: none; background: var(--bg-input); }
  .day-cell { min-width: 100px; position: relative; }
  .day-cell.weekend { background: var(--bg-hover); }
  .day-cell.today-hl { background: #f0f7ff; }
  .day-cell.future { color: var(--text-muted); }
  .time-display { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
  .time-display:hover { background: var(--bg-hover); }
  .time-in { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--text-primary); font-weight: 500; }
  .time-out { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--text-secondary); }
  .time-arrow { color: var(--text-muted); font-size: 11px; }
  .day-future { color: var(--text-muted); font-size: 12px; }
  .late-icon { color: #f59e0b; font-size: 11px; }
  .ot-icon { color: #22c55e; font-weight: 700; font-size: 11px; }
  .early-icon { color: #6366f1; font-size: 11px; }
  .time-exp { font-size: 10px; color: #94a3b8; }
  .time-edit-popup { display: flex; flex-direction: column; gap: 4px; padding: 6px; background: var(--bg-card); border: 2px solid #5865f2; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); position: absolute; z-index: 10; min-width: 160px; }
  .time-edit-row { display: flex; align-items: center; gap: 4px; }
  .time-input { width: 48px; padding: 3px 4px; border: 1px solid var(--border-input); border-radius: 4px; font-size: 12px; font-weight: 500; text-align: center; outline: none; }
  .time-input:focus { border-color: #5865f2; }
  .time-sep { color: var(--text-muted); font-size: 11px; }
  .late-label { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #d97706; cursor: pointer; user-select: none; }
  .late-label input { margin: 0; }
  .time-edit-actions { display: flex; gap: 4px; justify-content: center; }
  .btn-edit { padding: 3px 10px; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; background: var(--bg-hover); color: var(--text-primary); }
  .btn-edit.primary { background: #5865f2; color: white; }
  .btn-edit.primary:hover { background: #4752c4; }
  .btn-edit:hover { background: var(--border); }
  .badge-cell { padding: 4px 6px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.3px; line-height: 1.4; }
  .badge-present { background: #dcfce7; color: #16a34a; }
  .badge-absent { background: #fef2f2; color: #dc2626; }
  .badge-late { background: #fef3c7; color: #d97706; }
  .badge-rest { background: #e0e7ff; color: #4f46e5; }
  .badge-future { background: #f5f5f5; color: #bbb; }
  .badge-holiday { background: #fce7f3; color: #db2777; }
  .badge-sl { background: #fce4ec; color: #c62828; }
  .badge-vl { background: #e8f5e9; color: #2e7d32; }
  .badge-el { background: #fff3e0; color: #e65100; }
  .badge-bdl { background: #e3f2fd; color: #1565c0; }
  .badge-ob { background: #f3e5f5; color: #7b1fa2; }
  .badge-leave { background: #f5f5f5; color: #616161; }
  .stat-cell { font-weight: 700; font-size: 13px; padding: 6px 8px; }
  .stat-cell.pres { color: #22c55e; }
  .stat-cell.abs { color: #ef4444; }
  .summary-col { font-size: 11px; padding: 8px 8px; }
  .summary-col.pres { color: #22c55e; }
  .summary-col.abs { color: #ef4444; }
  tr.even td { background: var(--table-stripe); }
  tr.odd td { background: var(--bg-card); }
  tr:hover td { background: var(--bg-hover); }
  tr.even td.name-cell { background: var(--table-stripe); }
  tr.odd td.name-cell { background: var(--bg-card); }
  tr:hover td.name-cell { background: var(--bg-hover); }
</style>
