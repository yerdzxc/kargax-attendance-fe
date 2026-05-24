<script lang="ts">
  import type { UserAttendance } from '../types'

  let {
    users,
    dates,
    loading,
  }: { users: UserAttendance[]; dates: string[]; loading: boolean } = $props()

  let editing: string | null = $state(null)
  let editValue = $state('')

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
    if (!editValue.trim()) {
      editing = null
      return
    }
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

  function cancelEdit() {
    editing = null
  }

  function parseName(username: string): { surname: string; givenName: string } {
    const commaIdx = username.indexOf(',')
    if (commaIdx > -1) {
      return { surname: username.substring(0, commaIdx).trim(), givenName: username.substring(commaIdx + 1).trim() }
    }
    const spaceIdx = username.indexOf(' ')
    if (spaceIdx > -1) {
      return { surname: username.substring(0, spaceIdx).trim(), givenName: username.substring(spaceIdx + 1).trim() }
    }
    return { surname: '', givenName: username }
  }

  function handleKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') saveEdit(id)
    if (e.key === 'Escape') cancelEdit()
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
          <th class="name">Name <span class="hint">(click to edit)</span></th>
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
              {/if}
            </td>
            {#each user.days as day}
              {#if day.present}
                <td class="time-cell present">{day.timeIn || '--'}</td>
                <td class="time-cell present">{day.timeOut || '--'}</td>
              {:else}
                <td class="time-cell absent" colspan="2">—</td>
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
  th.name { text-align: left; padding-left: 16px; min-width: 180px; position: sticky; left: 0; background: #f8f9fa; z-index: 1; }
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
  .given { display: block; font-weight: 500; color: #333; font-size: 13px; }
  .surname { font-size: 11px; color: #999; }
  .name-input { width: 100%; padding: 4px 6px; border: 2px solid #5865f2; border-radius: 4px; font-size: 13px; font-weight: 500; outline: none; background: white; }
  .time-cell { font-variant-numeric: tabular-nums; font-size: 12px; }
  .time-cell.present { color: #333; }
  .time-cell.absent { color: #ccc; font-size: 11px; }
  .stat { font-weight: 700; font-size: 14px; }
  .stat.present { color: #22c55e; }
  .stat.absent { color: #ef4444; }
  tr.even td { background: #fafbfc; }
  tr.odd td { background: white; }
  tr:hover td { background: #f0f4ff; }
  .summary-col { font-size: 11px; min-width: 40px; }
</style>
