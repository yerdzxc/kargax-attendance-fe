<script lang="ts">
  import { onMount } from 'svelte'
  import { listHolidays, upsertHoliday, removeHoliday, listLeaves, upsertLeave, removeLeave, setRestDay, fetchAttendance, listUsers, setUserActive, setPosition, setName, setUserType } from '$lib/api'
  import type { HolidayRecord, LeaveRecord, ExportUser } from '$lib/types'

  let tab = $state<'holidays' | 'leaves' | 'restdays' | 'users'>('holidays')

  let holidays: HolidayRecord[] = $state([])
  let leaves: LeaveRecord[] = $state([])
  let users: ExportUser[] = $state([])
  let allUsers = $state<{ discordId: string; username: string; type: string; active: boolean; lastAccess: string | null; position: string | null }[]>([])
  let loading = $state(true)
  let message = $state('')

  let newHolidayDate = $state('')
  let newHolidayName = $state('')

  let newLeaveUserId = $state('')
  let newLeaveDate = $state('')
  let newLeaveType = $state('SL')

  let restDayEdit: Record<string, string> = $state({})
  let positionEdit: Record<string, string> = $state({})
  let nameEdit: Record<string, string> = $state({})
  let typeEdit: Record<string, string> = $state({})
  let editingName: Record<string, boolean> = $state({})
  let userSearch = $state('')
  let userTypeFilter = $state('all')
  let userActiveFilter = $state('all')

  const filteredUsers = $derived(
    allUsers.filter((u) => {
      if (userTypeFilter !== 'all' && u.type !== userTypeFilter) return false
      if (userActiveFilter === 'active' && !u.active) return false
      if (userActiveFilter === 'inactive' && u.active) return false
      if (userSearch && !u.username?.toLowerCase().includes(userSearch.toLowerCase())) return false
      return true
    })
  )

  function weekRange(): { from: string; to: string } {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    return { from: fmt(monday), to: fmt(sunday) }
  }

  async function load() {
    loading = true
    message = ''
    try {
      const range = weekRange()
      const [h, l, data, all] = await Promise.all([
        listHolidays(),
        listLeaves(),
        fetchAttendance(range.from, range.to, 'employee'),
        listUsers(),
      ])
      holidays = h
      leaves = l
      users = data.users
      allUsers = all
      for (const u of users) {
        restDayEdit[u.discordId] = u.restDay || ''
      }
      for (const u of all) {
        positionEdit[u.discordId] = u.position || ''
        nameEdit[u.discordId] = u.username || ''
        typeEdit[u.discordId] = u.type || 'employee'
      }
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to load data'
    } finally {
      loading = false
    }
  }

  async function addHoliday() {
    if (!newHolidayDate || !newHolidayName) return
    try {
      await upsertHoliday(newHolidayDate, newHolidayName)
      holidays = await listHolidays()
      newHolidayDate = ''
      newHolidayName = ''
      message = 'Holiday added.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to add holiday'
    }
  }

  async function deleteHoliday(date: string) {
    if (!confirm('Remove this holiday?')) return
    try {
      await removeHoliday(date)
      holidays = await listHolidays()
      message = 'Holiday removed.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to remove holiday'
    }
  }

  async function addLeave() {
    if (!newLeaveUserId || !newLeaveDate) return
    try {
      await upsertLeave(newLeaveUserId, newLeaveDate, newLeaveType)
      leaves = await listLeaves()
      newLeaveUserId = ''
      newLeaveDate = ''
      message = 'Leave added.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to add leave'
    }
  }

  async function deleteLeave(discordId: string, date: string) {
    if (!confirm('Remove this leave entry?')) return
    try {
      await removeLeave(discordId, date)
      leaves = await listLeaves()
      message = 'Leave removed.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to remove leave'
    }
  }

  async function saveRestDay(discordId: string) {
    const val = restDayEdit[discordId] || ''
    try {
      await setRestDay(discordId, val || null)
      message = val ? 'Rest day updated.' : 'Rest day cleared.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to set rest day'
    }
  }

  async function saveUser(discordId: string) {
    const name = nameEdit[discordId]?.trim()
    const position = positionEdit[discordId] || null
    const type = typeEdit[discordId]
    if (!name) return
    try {
      await Promise.all([
        setName(discordId, name),
        setPosition(discordId, position),
        setUserType(discordId, type),
      ])
      editingName[discordId] = false
      allUsers = allUsers.map((u) =>
        u.discordId === discordId ? { ...u, username: name, position, type } : u
      )
      message = 'User updated.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to update user'
    }
  }

  function startNameEdit(discordId: string) {
    editingName[discordId] = true
  }

  const leaveTypes = [
    { value: 'SL', label: 'Sick Leave (SL)' },
    { value: 'VL', label: 'Vacation Leave (VL)' },
    { value: 'EL', label: 'Emergency Leave (EL)' },
    { value: 'BDL', label: 'Birthday Leave (BDL)' },
    { value: 'OB', label: 'Official Business (OB)' },
  ]

  function userLabel(u: ExportUser): string {
    return u.username || u.discordId
  }

  onMount(load)
</script>

<div class="manage">
  <header class="header">
    <div>
      <h1>Manage</h1>
      <p class="subtitle">Holidays, Leaves & Rest Days</p>
    </div>
    <a href="/" class="back-link">← Back to Dashboard</a>
  </header>

  {#if message}
    <div class="toast" class:error={message.includes('Failed')}>{message}</div>
  {/if}

  <div class="tabs">
    <button class="tab" class:active={tab === 'holidays'} onclick={() => tab = 'holidays'}>Holidays</button>
    <button class="tab" class:active={tab === 'leaves'} onclick={() => tab = 'leaves'}>Leaves</button>
    <button class="tab" class:active={tab === 'restdays'} onclick={() => tab = 'restdays'}>Rest Days</button>
    <button class="tab" class:active={tab === 'users'} onclick={() => tab = 'users'}>Users</button>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if tab === 'holidays'}
    <div class="panel">
      <h2>Holidays</h2>
      <div class="add-form">
        <input type="date" bind:value={newHolidayDate} placeholder="Date" />
        <input type="text" bind:value={newHolidayName} placeholder="Holiday name" />
        <button class="btn primary" onclick={addHoliday} disabled={!newHolidayDate || !newHolidayName}>Add</button>
      </div>
      {#if holidays.length === 0}
        <div class="empty">No holidays set.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>Date</th><th>Name</th><th></th></tr>
          </thead>
          <tbody>
            {#each holidays as h (h.date)}
              <tr>
                <td>{h.date}</td>
                <td>{h.name}</td>
                <td><button class="btn small danger" onclick={() => deleteHoliday(h.date)}>Remove</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {:else if tab === 'leaves'}
    <div class="panel">
      <h2>Leaves</h2>
      <div class="add-form">
        <select bind:value={newLeaveUserId}>
          <option value="">Select user...</option>
          {#each users as u}
            <option value={u.discordId}>{userLabel(u)}</option>
          {/each}
        </select>
        <input type="date" bind:value={newLeaveDate} />
        <select bind:value={newLeaveType}>
          {#each leaveTypes as lt}
            <option value={lt.value}>{lt.label}</option>
          {/each}
        </select>
        <button class="btn primary" onclick={addLeave} disabled={!newLeaveUserId || !newLeaveDate}>Add</button>
      </div>
      {#if leaves.length === 0}
        <div class="empty">No leaves recorded.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>Date</th><th>User</th><th>Type</th><th></th></tr>
          </thead>
          <tbody>
            {#each leaves as l (l.id)}
              {@const u = users.find(x => x.discordId === l.discordUserId)}
              <tr>
                <td>{l.date}</td>
                <td>{u ? userLabel(u) : l.discordUserId}</td>
                <td><span class="badge badge-{l.type.toLowerCase()}">{l.type}</span></td>
                <td><button class="btn small danger" onclick={() => deleteLeave(l.discordUserId, l.date)}>Remove</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {:else if tab === 'restdays'}
    <div class="panel">
      <h2>Rest Days</h2>
      <p class="hint">Set which day of the week each employee has off (e.g. "Sunday", "Saturday").</p>
      {#if users.length === 0}
        <div class="empty">No users found.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>User</th><th>Rest Day</th><th></th></tr>
          </thead>
          <tbody>
            {#each users as u}
              <tr>
                <td>{userLabel(u)}</td>
                <td>
                  <select bind:value={restDayEdit[u.discordId]}>
                    <option value="">— None —</option>
                    {#each ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as day}
                      <option value={day}>{day}</option>
                    {/each}
                  </select>
                </td>
                <td><button class="btn small primary" onclick={() => saveRestDay(u.discordId)}>Save</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {:else if tab === 'users'}
    <div class="panel">
      <h2>All Users</h2>
      <p class="hint">Manage user access. Deactivate former employees, reactivate returning ones.</p>
      <div class="user-filters">
        <input type="text" bind:value={userSearch} placeholder="Search by name..." />
        <select bind:value={userActiveFilter}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select bind:value={userTypeFilter}>
          <option value="all">All Types</option>
          <option value="employee">Employee</option>
          <option value="intern">Intern</option>
        </select>
        <span class="user-count">{filteredUsers.length} users</span>
      </div>
      {#if filteredUsers.length === 0}
        <div class="empty">No users match your filter.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>User</th><th>Type</th><th>Position</th><th>Status</th><th>Last Access</th><th></th></tr>
          </thead>
          <tbody>
            {#each filteredUsers as u}
              <tr>
                <td>
                  <span class="discord-id" title="Click to copy Discord ID" onclick={(e) => { navigator.clipboard.writeText(u.discordId); (e.target as HTMLElement).textContent = 'Copied!'; setTimeout(() => (e.target as HTMLElement).textContent = u.discordId, 1500); }}>{u.discordId}</span>
                  {#if editingName[u.discordId]}
                    <input type="text" bind:value={nameEdit[u.discordId]} />
                  {:else}
                    <span class="editable-name" title="{u.username || u.discordId}" ondblclick={() => startNameEdit(u.discordId)}>{u.username || u.discordId}</span>
                  {/if}
                </td>
                <td>
                  <select bind:value={typeEdit[u.discordId]}>
                    <option value="employee">Employee</option>
                    <option value="intern">Intern</option>
                  </select>
                </td>
                <td>
                  <input type="text" bind:value={positionEdit[u.discordId]} placeholder="—" />
                </td>
                <td>
                  <span class="badge" class:badge-active={u.active} class:badge-inactive={!u.active}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{u.lastAccess || '—'}</td>
                <td>
                  <button class="btn small primary" onclick={() => saveUser(u.discordId)}>Save</button>
                  <button class="btn small" onclick={async () => {
                    await setUserActive(u.discordId, !u.active)
                    allUsers = await listUsers()
                    message = u.active ? 'User deactivated.' : 'User reactivated.'
                  }}>{u.active ? 'Deactivate' : 'Reactivate'}</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</div>

<style>
  .manage { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  .subtitle { font-size: 13px; color: #888; margin-top: 2px; }
  .back-link { font-size: 13px; color: #5865f2; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }
  .toast { padding: 10px 14px; border-radius: 8px; background: #dcfce7; color: #16a34a; font-size: 13px; margin-bottom: 16px; }
  .toast.error { background: #fef2f2; color: #dc2626; }
  .tabs { display: flex; gap: 0; margin-bottom: 20px; background: white; border-radius: 10px; overflow: hidden; border: 1px solid #eee; }
  .tab { flex: 1; padding: 12px; background: white; border: none; font-size: 13px; font-weight: 600; color: #888; cursor: pointer; transition: all 0.15s; }
  .tab:hover { background: #f8f9fa; }
  .tab.active { background: #5865f2; color: white; }
  .panel { background: white; border-radius: 10px; padding: 20px; border: 1px solid #eee; }
  .panel h2 { font-size: 16px; margin-bottom: 16px; color: #333; }
  .loading { padding: 48px; text-align: center; color: #888; font-size: 14px; }
  .empty { padding: 24px; text-align: center; color: #aaa; font-size: 13px; }
  .hint { font-size: 12px; color: #888; margin-bottom: 16px; }
  .add-form { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .add-form input, .add-form select { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
  .btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.primary { background: #5865f2; color: white; }
  .btn.primary:hover:not(:disabled) { background: #4752c4; }
  .btn.danger { background: #ef4444; color: white; }
  .btn.danger:hover:not(:disabled) { background: #dc2626; }
  .btn.small { padding: 4px 10px; font-size: 11px; }
  .list { width: 100%; border-collapse: collapse; font-size: 13px; }
  .list th { text-align: left; padding: 8px 10px; font-weight: 600; color: #555; border-bottom: 2px solid #eee; }
  .list td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
  .list td input, .list td select { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; }
  .list td select { min-width: 90px; }
  .list td input { width: 100px; }
  .list tr:hover td { background: #f8f9fa; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .badge-active { background: #dcfce7; color: #16a34a; }
  .badge-inactive { background: #fef2f2; color: #dc2626; }
  .badge-sl { background: #fce4ec; color: #c62828; }
  .badge-vl { background: #e8f5e9; color: #2e7d32; }
  .badge-el { background: #fff3e0; color: #e65100; }
  .badge-bdl { background: #e3f2fd; color: #1565c0; }
  .badge-ob { background: #f3e5f5; color: #7b1fa2; }
  .user-filters { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
  .user-filters input { flex: 1; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
  .user-filters select { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
  .user-count { font-size: 12px; color: #888; white-space: nowrap; }
  .inline-edit { display: flex; gap: 4px; align-items: center; }
  .inline-edit input { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 140px; }
  .editable-name { cursor: pointer; border-bottom: 1px dashed #ccc; }
  .editable-name:hover { border-color: #5865f2; }
  .discord-id { display: block; font-size: 10px; color: #aaa; cursor: pointer; }
  .discord-id:hover { color: #5865f2; text-decoration: underline; }

</style>
