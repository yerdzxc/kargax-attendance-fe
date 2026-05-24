<script lang="ts">
  import { onMount } from 'svelte';
  import type { UserAttendance } from '$lib/types';
  import { fetchAttendance, generateDates, getWeekRange } from '$lib/api';
  import SummaryCards from '$lib/components/SummaryCards.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import AttendanceTable from '$lib/components/AttendanceTable.svelte';

  let users: UserAttendance[] = $state([]);
  let dates: string[] = $state([]);
  let loading = $state(true);

  let from = $state('');
  let to = $state('');
  let type = $state('employee');
  let search = $state('');
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      users = await fetchAttendance(from, to, type);
      dates = generateDates(from, to);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
      users = [];
      dates = [];
    } finally {
      loading = false;
    }
  }

  function handleSearch(v: string) { search = v; }

  function handleTypeChange(v: string) {
    type = v;
    load();
  }

  function handleDateChange(f: string, t: string) {
    from = f;
    to = t;
    load();
  }

  function handleDownload() {
    const range = getWeekRange();
    const fromDate = from || range.from;
    const toDate = to || range.to;
    window.open(`/api/export?from=${fromDate}&to=${toDate}&type=${type}`, '_blank');
  }

  const filteredUsers = $derived(
    search
      ? users.filter(
          (u) =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.givenName.toLowerCase().includes(search.toLowerCase()) ||
            u.surname.toLowerCase().includes(search.toLowerCase()),
        )
      : users,
  );

  const totalPresent = $derived(filteredUsers.reduce((sum, u) => sum + u.totalPresent, 0));
  const totalAbsent = $derived(filteredUsers.reduce((sum, u) => sum + u.totalAbsent, 0));

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
  </header>

  <main class="main">
    {#if error}
      <div class="error-banner">
        <span>{error}</span>
        <button onclick={load}>Retry</button>
      </div>
    {/if}

    <SummaryCards totalUsers={filteredUsers.length} totalPresent={totalPresent} totalAbsent={totalAbsent} />

    <FilterBar
      {from} {to} {type} {search} {loading}
      onSearch={handleSearch}
      onTypeChange={handleTypeChange}
      onDateChange={handleDateChange}
      onDownload={handleDownload}
      onRefresh={load}
    />

    <AttendanceTable {users} {dates} {loading} />
  </main>

  <footer class="footer">
    <span>KargaX Attendance System</span>
  </footer>
</div>

<style>
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; min-height: 100vh; }
  .app { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  .subtitle { font-size: 13px; color: #888; margin-top: 2px; }
  .main { min-height: 60vh; }
  .error-banner { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #b91c1c; font-size: 13px; margin-bottom: 16px; }
  .error-banner button { padding: 6px 12px; background: #b91c1c; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
  .error-banner button:hover { background: #991b1b; }
  .footer { text-align: center; padding: 32px 0 16px; font-size: 11px; color: #aaa; }
</style>
