<script lang="ts">
  import type { UserAttendance } from '$lib/types'

  let {
    users,
    dates,
    loading,
  }: { users: UserAttendance[]; dates: string[]; loading: boolean } = $props()

  let editing: string | null = $state(null)
  let editValue = $state('')

  let timeEdit: { userId: string; date: string; field: 'in' | 'out'; value: string; late: boolean } | null = $state(null)

  function dayLabel(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

  function startTimeEdit(userId: string, date: string, field: 'in' | 'out', current: string, late: boolean) {
    timeEdit = { userId, date, field, value: current, late }
  }

  async function saveTimeEdit() {
    if (!timeEdit) return
    const { userId, date, field, value, late } = timeEdit
    const timeVal = value.trim()
    try {
      const body: any = { discordUserId: userId, signatureDate: date, late }
      if (field === 'in') body.timeIn = timeVal || undefined
      else body.timeOut = timeVal || undefined
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
          if (field === 'in') { day.timeIn = timeVal; day.status = late ? 'late' : 'present' }
          else day.timeOut = timeVal
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

  function isTimeEditing(userId: string, date: string, field: 'in' | 'out'): boolean {
    return timeEdit !== null && timeEdit.userId === userId && timeEdit.date === date && timeEdit.field === field
  }
</script>

<div class="table-wrapper">
  {#if loading}
    <div class="loading">Loading attendance data...</div>
  {:else if users.length === 0}
    <div class="empty">No records found for the selected period.</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th class="name">Name <span class="hint">(dbl-click)</span></th>
          {#each dates as date}
            <th class="date" colspan="2">
              <span class="day">{dayLabel(date)}</span>
              <span class="date-num">{formatDate(date)}</span>
            </th>
          {/each}
          <th class="summary-col">Pres.</th>
          <th class="summary-col">Abs.</th>
        </tr>
        <tr class="subhead">
          <th></th>
          {#each dates as _}
            <th class="time-label">In</th>
            <th class="time-label">Out</th>
          {/each}
          <th></th>
          <th></th>
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
              {#if day.status === 'future'}
                <td class="time-cell future" colspan="2">—</td>
              {:else if day.present || day.status === 'late'}
                <td class="time-cell in" ondblclick={() => startTimeEdit(user.discordId, day.date, 'in', day.timeIn, day.status === 'late')}>
                  {#if isTimeEditing(user.discordId, day.date, 'in')}
                    <div class="time-edit-popup">
                      <input type="text" class="time-input" bind:value={timeEdit!.value} onblur={saveTimeEdit} onkeydown={handleTimeKeydown} autofocus placeholder="HH:mm" />
                      <label class="late-label"><input type="checkbox" bind:checked={timeEdit!.late} /> Late</label>
                    </div>
                  {:else}
                    {day.timeIn || '--'}
                    {#if day.status === 'late'}
                      <span class="late-icon">⚠</span>
                    {/if}
                  {/if}
                </td>
                <td class="time-cell out" ondblclick={() => startTimeEdit(user.discordId, day.date, 'out', day.timeOut, day.status === 'late')}>
                  {#if isTimeEditing(user.discordId, day.date, 'out')}
                    <div class="time-edit-popup">
                      <input type="text" class="time-input" bind:value={timeEdit!.value} onblur={saveTimeEdit} onkeydown={handleTimeKeydown} autofocus placeholder="HH:mm" />
                      <label class="late-label"><input type="checkbox" bind:checked={timeEdit!.late} /> Late</label>
                    </div>
                  {:else}
                    {day.timeOut || '--'}
                    {#if day.overtime}
                      <span class="ot-icon">+</span>
                    {/if}
                  {/if}
                </td>
              {:else}
                <td class="time-cell badge-cell" colspan="2">
                  <span class="badge {badge.cls}">{badge.label}</span>
                </td>
              {/if}
            {/each}
            <td class="stat present">{user.totalPresent}</td>
            <td class="stat absent">{user.totalAbsent}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .table-wrapper { overflow-x: auto; background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #eee; }
  .loading, .empty { padding: 48px 24px; text-align: center; color: #888; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 600px; }
  th { background: #f8f9fa; padding: 10px 6px; font-weight: 600; color: #555; text-align: center; border-bottom: 2px solid #eee; white-space: nowrap; }
  th.name { text-align: left; padding-left: 16px; min-width: 200px; position: sticky; left: 0; background: #f8f9fa; z-index: 1; }
  .hint { font-weight: 400; font-size: 10px; color: #aaa; }
  .subhead th { background: #f2f3f5; padding: 4px 6px; font-size: 11px; color: #999; border-bottom: 1px solid #eee; }
  .subhead th:first-child { position: sticky; left: 0; background: #f2f3f5; z-index: 1; }
  .date { padding: 6px 4px; min-width: 52px; }
  .date .day { display: block; font-size: 11px; color: #888; }
  .date .date-num { font-size: 12px; color: #444; }
  .time-label { font-size: 10px; font-weight: 400; color: #aaa; }
  td { padding: 8px 6px; text-align: center; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
  .name-cell { text-align: left; padding-left: 16px; position: sticky; left: 0; background: inherit; z-index: 0; cursor: pointer; }
  .name-cell:hover .given { color: #5865f2; }
  .given { display: inline; font-weight: 500; color: #333; font-size: 13px; }
  .surname { font-size: 11px; color: #999; margin-left: 4px; }
  .restday-tag { display: inline-block; font-size: 9px; background: #f0f0f0; color: #888; padding: 1px 5px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
  .position { display: block; font-size: 10px; color: #888; font-weight: 400; }
  .name-input { width: 100%; padding: 4px 6px; border: 2px solid #5865f2; border-radius: 4px; font-size: 13px; font-weight: 500; outline: none; background: white; }
  .time-cell { font-variant-numeric: tabular-nums; font-size: 12px; position: relative; cursor: pointer; }
  .time-cell:hover { background: #f8faff; }
  .time-cell.in { color: #333; }
  .time-cell.out { color: #555; }
  .time-input { width: 52px; padding: 2px 4px; border: 2px solid #5865f2; border-radius: 4px; font-size: 12px; font-weight: 500; outline: none; background: white; text-align: center; font-variant-numeric: tabular-nums; }
  .time-edit-popup { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .late-label { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #d97706; cursor: pointer; user-select: none; }
  .late-label input { margin: 0; }
  .late-icon { color: #f59e0b; font-size: 10px; margin-left: 2px; }
  .ot-icon { color: #22c55e; font-weight: 700; font-size: 12px; margin-left: 2px; }
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
  .stat { font-weight: 700; font-size: 14px; }
  .stat.present { color: #22c55e; }
  .stat.absent { color: #ef4444; }
  tr.even td { background: #fafbfc; }
  tr.odd td { background: white; }
  tr:hover td { background: #f0f4ff; }
  .summary-col { font-size: 11px; min-width: 40px; }
</style>
