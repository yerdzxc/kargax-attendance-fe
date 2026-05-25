<script lang="ts">
  import { onMount } from 'svelte'
  import { listHolidays, upsertHoliday, removeHoliday, listLeaves, upsertLeave, removeLeave, setRestDay, fetchAttendance, listUsers, setUserActive, setPosition, setName, setUserType, batchSetActive, batchSetType, listOvertimeRequests, approveOvertime, rejectOvertime, createOvertimeRequest } from '$lib/api'
  import type { HolidayRecord, LeaveRecord, ExportUser, OvertimeRequest } from '$lib/types'

  let tab = $state<'holidays' | 'leaves' | 'restdays' | 'users' | 'activity' | 'overtime'>('holidays')

  let holidays: HolidayRecord[] = $state([])
  let leaves: LeaveRecord[] = $state([])
  let users: ExportUser[] = $state([])
  let allUsers = $state<{ discordId: string; username: string; type: string; active: boolean; lastAccess: string | null; position: string | null }[]>([])
  let activityLog = $state<{ id: number; action: string; targetId: string | null; detail: string | null; created_at: string }[]>([])
  let overtimeRequests = $state<OvertimeRequest[]>([])
  let otNote = $state<Record<number, string>>({})
  let otStatusFilter = $state<string>('pending')
  let otNewUser = $state('')
  let otNewDate = $state(new Date().toISOString().split('T')[0])
  let otNewHours = $state(1)
  let otNewType = $state<'pre' | 'post'>('post')
  let otNewNote = $state('')
  let loading = $state(true)
  let message = $state('')

  let newHolidayDate = $state('')
  let newHolidayName = $state('')
  let newHolidayRecurring = $state(false)

  const phHolidays: { name: string; date: string }[] = [
    { name: 'New Year\'s Day', date: '2026-01-01' },
    { name: 'Araw ng Kagitingan', date: '2026-04-09' },
    { name: 'Labor Day', date: '2026-05-01' },
    { name: 'Independence Day', date: '2026-06-12' },
    { name: 'National Heroes Day', date: '2026-08-31' },
    { name: 'Bonifacio Day', date: '2026-11-30' },
    { name: 'Christmas Day', date: '2026-12-25' },
    { name: 'Rizal Day', date: '2026-12-30' },
  ]

  let newLeaveUserId = $state('')
  let newLeaveDate = $state('')
  let newLeaveType = $state('SL')

  let restDayEdit: Record<string, string> = $state({})
  let positionEdit: Record<string, string> = $state({})
  let nameEdit: Record<string, string> = $state({})
  let typeEdit: Record<string, string> = $state({})
  let editingName: Record<string, boolean> = $state({})
  let selected = $state<Set<string>>(new Set())
  let bulkType = $state('employee')

  const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

  function restDayList(discordId: string): string[] {
    const val = restDayEdit[discordId] || ''
    return val ? val.split(',').map((d) => d.trim()).filter(Boolean) : []
  }

  function toggleRestDay(discordId: string, day: string) {
    let list = restDayList(discordId)
    if (list.includes(day)) {
      list = list.filter((d) => d !== day)
    } else {
      list.push(day)
    }
    restDayEdit[discordId] = list.join(',')
    setRestDay(discordId, list.join(',') || null).catch(() => {})
  }

  function toggleSelect(discordId: string) {
    if (selected.has(discordId)) selected.delete(discordId)
    else selected.add(discordId)
    selected = new Set(selected)
  }

  function toggleSelectAll() {
    if (selected.size === filteredUsers.length) {
      selected = new Set()
    } else {
      selected = new Set(filteredUsers.map((u) => u.discordId))
    }
  }

  async function batchAction(action: 'activate' | 'deactivate' | 'change-type') {
    if (selected.size === 0) return
    const ids = [...selected]
    try {
      if (action === 'activate') {
        await batchSetActive(ids, true)
        message = `${ids.length} user(s) reactivated.`
      } else if (action === 'deactivate') {
        await batchSetActive(ids, false)
        message = `${ids.length} user(s) deactivated.`
      } else {
        await batchSetType(ids, bulkType)
        message = `${ids.length} user(s) type changed to ${bulkType}.`
      }
      selected = new Set()
      allUsers = await listUsers()
    } catch (e) {
      message = e instanceof Error ? e.message : 'Batch action failed'
    }
  }
  let userSearch = $state('')
  let userTypeFilter = $state('all')
  let userActiveFilter = $state('active')

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

  async function loadOvertime() {
    try {
      const range = weekRange()
      overtimeRequests = await listOvertimeRequests(range.from, range.to)
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to load OT requests'
    }
  }

  async function handleApprove(id: number) {
    await approveOvertime(id, otNote[id] || undefined)
    message = 'Overtime approved.'
    loadOvertime()
  }

  async function handleReject(id: number) {
    await rejectOvertime(id, otNote[id] || undefined)
    message = 'Overtime rejected.'
    loadOvertime()
  }

  async function handleCreateOt() {
    if (!otNewUser || !otNewDate || !otNewHours) return
    try {
      await createOvertimeRequest(otNewUser, otNewDate, otNewHours, otNewType, otNewNote || undefined)
      message = 'Overtime filed.'
      otNewNote = ''
      otNewHours = 1
      loadOvertime()
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to file OT'
    }
  }

  async function load() {
    loading = true
    message = ''
    try {
      const range = weekRange()
      const [h, l, data, all, log, ots] = await Promise.all([
        listHolidays(),
        listLeaves(),
        fetchAttendance(range.from, range.to, 'employee'),
        listUsers(),
        fetch('/api/activity-log').then((r) => r.json()),
        listOvertimeRequests(undefined, undefined, 'pending'),
      ])
      holidays = h
      leaves = l
      users = data.users
      allUsers = all
      activityLog = log
      overtimeRequests = ots
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
      await upsertHoliday(newHolidayDate, newHolidayName, newHolidayRecurring)
      holidays = await listHolidays()
      newHolidayDate = ''
      newHolidayName = ''
      newHolidayRecurring = false
      message = 'Holiday added.'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to add holiday'
    }
  }

  async function populatePhHolidays() {
    try {
      for (const h of phHolidays) {
        await upsertHoliday(h.date, h.name, true)
      }
      holidays = await listHolidays()
      message = 'PH holidays populated (recurring).'
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to populate holidays'
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
      message = val ? 'Rest day(s) updated.' : 'Rest days cleared.'
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
    <button class="tab" class:active={tab === 'activity'} onclick={() => tab = 'activity'}>Activity</button>
    <button class="tab" class:active={tab === 'overtime'} onclick={() => { tab = 'overtime'; loadOvertime() }}>Overtime</button>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if tab === 'holidays'}
    <div class="panel">
      <h2>Holidays</h2>
      <div class="add-form">
        <input type="date" bind:value={newHolidayDate} placeholder="Date" />
        <input type="text" bind:value={newHolidayName} placeholder="Holiday name" />
        <label class="chk-label"><input type="checkbox" bind:checked={newHolidayRecurring} /> Recurring yearly</label>
        <button class="btn primary" onclick={addHoliday} disabled={!newHolidayDate || !newHolidayName}>Add</button>
      </div>
      <div class="add-form">
        <button class="btn secondary" onclick={populatePhHolidays}>🇵🇭 Pre-populate PH Holidays</button>
      </div>
      {#if holidays.length === 0}
        <div class="empty">No holidays set.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>Date</th><th>Name</th><th>Type</th><th></th></tr>
          </thead>
          <tbody>
            {#each holidays as h (h.date)}
              <tr>
                <td>{h.date}</td>
                <td>{h.name}</td>
                <td>{#if h.recurring}<span class="recurring-badge">Recurring</span>{:else}One-time{/if}</td>
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
      <p class="hint">Set which day(s) of the week each employee has off. Check all that apply.</p>
      {#if users.length === 0}
        <div class="empty">No users found.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>User</th><th>Rest Day</th></tr>
          </thead>
          <tbody>
            {#each users as u}
              <tr>
                <td>{userLabel(u)}</td>
                <td>
                  <div class="restday-pills">
                    {#each daysOfWeek as day}
                      {@const active = restDayList(u.discordId).includes(day)}
                      <button
                        class="restday-pill"
                        class:active
                        onclick={() => toggleRestDay(u.discordId, day)}
                      >{day.substring(0, 3)}</button>
                    {/each}
                  </div>
                </td>
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
      {#if selected.size > 0}
        <div class="bulk-bar">
          <span class="bulk-count">{selected.size} selected</span>
          <button class="btn small primary" onclick={() => batchAction('activate')}>Reactivate</button>
          <button class="btn small danger" onclick={() => batchAction('deactivate')}>Deactivate</button>
          <select bind:value={bulkType} class="bulk-type-select">
            <option value="employee">Employee</option>
            <option value="intern">Intern</option>
          </select>
          <button class="btn small primary" onclick={() => batchAction('change-type')}>Change Type</button>
          <button class="btn small" onclick={() => selected = new Set()}>Clear</button>
        </div>
      {/if}
      {#if filteredUsers.length === 0}
        <div class="empty">No users match your filter.</div>
      {:else}
        <table class="list">
          <thead>
            <tr>
              <th class="chk"><input type="checkbox" checked={selected.size === filteredUsers.length && filteredUsers.length > 0} onchange={toggleSelectAll} /></th>
              <th>User</th><th>Type</th><th>Position</th><th>Status</th><th>Last Access</th><th></th>
            </tr>
          </thead>
          <tbody>
            {#each filteredUsers as u}
              <tr>
                <td class="chk"><input type="checkbox" checked={selected.has(u.discordId)} onchange={() => toggleSelect(u.discordId)} /></td>
                <td>
                  <span class="discord-id" title="Click to copy Discord mention (&lt;@ID&gt;)" onclick={(e) => { navigator.clipboard.writeText(`<@${u.discordId}>`); const el = e.target as HTMLElement; el.textContent = '@Copied!'; setTimeout(() => el.textContent = '@' + u.discordId, 1500); }}>@{u.discordId}</span>
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
  {:else if tab === 'activity'}
    <div class="panel">
      <h2>Activity Log</h2>
      {#if activityLog.length === 0}
        <div class="empty">No activity recorded yet.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>Time</th><th>Action</th><th>Target</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {#each activityLog as entry}
              <tr>
                <td class="log-time">{new Date(entry.created_at).toLocaleString()}</td>
                <td><span class="log-action">{entry.action.replace(/_/g, ' ')}</span></td>
                <td>{entry.targetId || '—'}</td>
                <td class="log-detail">{entry.detail || '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {:else if tab === 'overtime'}
    <div class="panel">
      <div class="section-header">
        <h2>Overtime Requests</h2>
        <select class="status-filter" bind:value={otStatusFilter}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      <details class="ot-info">
        <summary>How employees file overtime via Discord</summary>
        <div class="ot-info-content">
          <p>Employees use the <code>/ot</code> command in Discord:</p>
          <div class="ot-cmd">
            <code>/ot date:2026-05-26 hours:2 type:post reason:Finishing report</code>
          </div>
          <table class="ot-info-table">
            <thead><tr><th>Option</th><th>Description</th><th>Limits</th></tr></thead>
            <tbody>
              <tr><td><code>date</code></td><td>Date of overtime (YYYY-MM-DD)</td><td>—</td></tr>
              <tr><td><code>hours</code></td><td>Number of OT hours</td><td><strong>Post-shift:</strong> max 5h<br><strong>Pre-shift:</strong> max 3h<br><strong>Rest Day:</strong> max 8h<br><strong>Holiday:</strong> max 8h</td></tr>
              <tr><td><code>type</code></td><td><code>post</code> / <code>pre</code> / <code>rd</code> / <code>holiday</code></td><td>Post: after shift<br>Pre: before shift<br>RD: rest day OT<br>Holiday: holiday OT</td></tr>
              <tr><td><code>reason</code></td><td>Optional note</td><td>—</td></tr>
            </tbody>
          </table>
          <p>Once filed, the request appears here as <span class="status-badge status-pending">pending</span> for HR to review.</p>
        </div>
      </details>

      <details class="ot-form">
        <summary>File Overtime for Employee</summary>
        <div class="ot-form-fields">
          <select class="ot-field" bind:value={otNewUser}>
            <option value="">Select user…</option>
            {#each allUsers as u}
              <option value={u.discordId}>{u.username || u.discordId}</option>
            {/each}
          </select>
          <input class="ot-field" type="date" bind:value={otNewDate} />
          <input class="ot-field" type="number" min="0.5" max="8" step="0.5" bind:value={otNewHours} />
          <select class="ot-field" bind:value={otNewType}>
            <option value="post">Post-shift</option>
            <option value="pre">Pre-shift</option>
            <option value="rd">Rest Day</option>
            <option value="holiday">Holiday</option>
          </select>
          <input class="ot-field" type="text" placeholder="Reason..." bind:value={otNewNote} />
          <button class="btn-ot-submit" onclick={handleCreateOt}>File OT</button>
        </div>
      </details>

      <div class="ot-actions">
        <button class="btn-refresh" onclick={loadOvertime}>↻ Refresh</button>
      </div>
      {#if overtimeRequests.length === 0}
        <div class="empty">No overtime requests found.</div>
      {:else}
        <table class="list">
          <thead>
            <tr><th>Date</th><th>User</th><th>Type</th><th>Hours</th><th>Note</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {#each overtimeRequests.filter((r) => !otStatusFilter || r.status === otStatusFilter) as req}
              <tr>
                <td>{req.date}</td>
                <td>@{req.discordUserId}</td>
                <td class="ot-type">{req.type === 'pre' ? 'Pre-shift' : 'Post-shift'}</td>
                <td>{req.hours}h</td>
                <td class="log-detail">{req.note || '—'}</td>
                <td><span class="status-badge status-{req.status}">{req.status}</span></td>
                <td>
                  {#if req.status === 'pending'}
                    <div class="ot-actions-row">
                      <input class="ot-note-input" type="text" placeholder="Note..." bind:value={otNote[req.id]} />
                      <button class="btn-approve" onclick={() => handleApprove(req.id)}>✓</button>
                      <button class="btn-reject" onclick={() => handleReject(req.id)}>✗</button>
                    </div>
                  {:else}
                    <span class="muted">{req.status === 'approved' ? 'Approved' : 'Rejected'}</span>
                  {/if}
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
  .bulk-bar { display: flex; gap: 8px; align-items: center; padding: 10px 12px; background: #f0f4ff; border-radius: 8px; margin-bottom: 12px; }
  .bulk-count { font-size: 12px; font-weight: 600; color: #5865f2; }
  .bulk-type-select { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; }
  .chk { width: 32px; text-align: center; }
  .restday-pills { display: flex; gap: 4px; flex-wrap: wrap; }
  .restday-pill { padding: 3px 10px; border: 1px solid #ddd; border-radius: 12px; background: white; font-size: 11px; color: #888; cursor: pointer; transition: all 0.15s; }
  .restday-pill:hover { border-color: #5865f2; color: #5865f2; }
  .restday-pill.active { background: #5865f2; border-color: #5865f2; color: white; }
  .inline-edit { display: flex; gap: 4px; align-items: center; }
  .inline-edit input { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 140px; }
  .editable-name { cursor: pointer; border-bottom: 1px dashed #ccc; }
  .editable-name:hover { border-color: #5865f2; }
  .discord-id { display: block; font-size: 10px; color: #aaa; cursor: pointer; }
  .discord-id:hover { color: #5865f2; }
  .log-time { font-size: 11px; color: #888; white-space: nowrap; }
  .log-action { text-transform: capitalize; }
  .log-detail { font-size: 12px; color: #555; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .section-header h2 { margin: 0; }
  .status-filter { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
  .ot-actions { margin-bottom: 12px; }
  .btn-refresh { padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px; background: white; font-size: 12px; cursor: pointer; }
  .btn-refresh:hover { border-color: #5865f2; color: #5865f2; }
  .ot-actions-row { display: flex; gap: 4px; align-items: center; }
  .ot-note-input { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; width: 100px; }
  .btn-approve { padding: 4px 10px; border: 1px solid #22c55e; border-radius: 4px; background: white; color: #22c55e; font-size: 13px; cursor: pointer; }
  .btn-approve:hover { background: #22c55e; color: white; }
  .btn-reject { padding: 4px 10px; border: 1px solid #ef4444; border-radius: 4px; background: white; color: #ef4444; font-size: 13px; cursor: pointer; }
  .btn-reject:hover { background: #ef4444; color: white; }
  .ot-type { font-size: 12px; text-transform: capitalize; }
  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .status-pending { background: #fef3c7; color: #d97706; }
  .status-approved { background: #dcfce7; color: #16a34a; }
  .status-rejected { background: #fef2f2; color: #dc2626; }
  .muted { color: #aaa; font-size: 12px; }
  .ot-form { margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
  .ot-form summary { font-size: 13px; font-weight: 600; color: #4f46e5; cursor: pointer; }
  .ot-form-fields { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; align-items: center; }
  .ot-field { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
  .ot-field[type="number"] { width: 60px; }
  .ot-field[type="date"] { width: 140px; }
  .btn-ot-submit { padding: 6px 14px; border: none; border-radius: 6px; background: #4f46e5; color: white; font-size: 13px; cursor: pointer; }
  .btn-ot-submit:hover { background: #4338ca; }
  .ot-info { margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f0fdf4; }
  .ot-info summary { font-size: 13px; font-weight: 600; color: #16a34a; cursor: pointer; }
  .ot-info-content { margin-top: 10px; font-size: 13px; color: #444; line-height: 1.6; }
  .ot-cmd { background: #1a1a2e; color: #e2e8f0; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin: 8px 0; overflow-x: auto; }
  .ot-info-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
  .ot-info-table th { background: #f8f9fa; padding: 6px 10px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #eee; }
  .ot-info-table td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
  .chk-label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #555; cursor: pointer; }
  .recurring-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #e0e7ff; color: #4f46e5; }
  .btn.secondary { padding: 8px 14px; border: 1px solid #ddd; border-radius: 6px; background: white; font-size: 13px; cursor: pointer; }
  .btn.secondary:hover { border-color: #5865f2; color: #5865f2; }

</style>
