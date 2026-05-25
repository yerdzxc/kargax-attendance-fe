<script lang="ts">
  let {
    from,
    to,
    type,
    search,
    loading,
    onSearch,
    onTypeChange,
    onDateChange,
    onPreset,
    onDownload,
    onPrint,
    onRefresh,
  }: {
    from: string
    to: string
    type: string
    search: string
    loading: boolean
    onSearch: (v: string) => void
    onTypeChange: (v: string) => void
    onDateChange: (from: string, to: string) => void
    onPreset: (preset: string) => void
    onDownload: () => void
    onPrint: () => void
    onRefresh: () => void
  } = $props()

  function handleFrom(e: Event) {
    const v = (e.target as HTMLInputElement).value
    onDateChange(v, to)
  }
  function handleTo(e: Event) {
    const v = (e.target as HTMLInputElement).value
    onDateChange(from, v)
  }

  const presets = [
    { key: 'this-week', label: 'This Week' },
    { key: 'last-week', label: 'Last Week' },
    { key: 'this-month', label: 'This Month' },
  ]
</script>

<div class="preset-row">
  <button class="preset-btn" onclick={() => onPreset('prev-week')} disabled={loading} title="Previous 7 days">← Prev</button>
  {#each presets as p}
    <button class="preset-btn" onclick={() => onPreset(p.key)} disabled={loading}>{p.label}</button>
  {/each}
  <button class="preset-btn" onclick={() => onPreset('next-week')} disabled={loading} title="Next 7 days">Next →</button>
</div>

<div class="filter-bar">
  <div class="filter-group">
    <label for="filter-from">From</label>
    <input id="filter-from" type="date" value={from} oninput={handleFrom} disabled={loading} />
  </div>
  <div class="filter-group">
    <label for="filter-to">To</label>
    <input id="filter-to" type="date" value={to} oninput={handleTo} disabled={loading} />
  </div>
  <div class="filter-group">
    <label for="filter-type">Type</label>
    <select
      id="filter-type"
      value={type}
      onchange={(e) => onTypeChange((e.target as HTMLSelectElement).value)}
      disabled={loading}
    >
      <option value="employee">Employee</option>
      <option value="intern">Intern</option>
    </select>
  </div>
  <div class="filter-group search">
    <label for="filter-search">Search</label>
    <input
      id="filter-search"
      type="text"
      placeholder="Filter by name..."
      value={search}
      oninput={(e) => onSearch((e.target as HTMLInputElement).value)}
    />
  </div>
  <div class="actions">
    <button class="btn primary" onclick={onRefresh} disabled={loading}>
      {loading ? 'Loading...' : 'Refresh'}
    </button>
    <button class="btn secondary" onclick={onDownload} disabled={loading}>
      Download CSV
    </button>
    <button class="btn secondary" onclick={onPrint} disabled={loading}>
      Print / PDF
    </button>
  </div>
</div>

<style>
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--bg-card);
    border-radius: 10px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
  }
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .filter-group.search {
    flex: 1;
    min-width: 160px;
  }
  label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  input,
  select {
    padding: 8px 10px;
    border: 1px solid var(--border-input);
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    background: var(--bg-input);
    transition: border-color 0.15s;
  }
  input:focus,
  select:focus {
    border-color: #5865f2;
    background: var(--bg-input);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.primary {
    background: #5865f2;
    color: white;
  }
  .btn.primary:hover:not(:disabled) {
    background: #4752c4;
  }
  .btn.secondary {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .btn.secondary:hover:not(:disabled) {
    background: var(--border);
  }
  .preset-row { display: flex; gap: 6px; margin-bottom: 8px; }
  .preset-btn { padding: 4px 12px; border: 1px solid var(--border-input); border-radius: 6px; background: var(--bg-card); font-size: 12px; color: var(--text-secondary); cursor: pointer; }
  .preset-btn:hover:not(:disabled) { border-color: #5865f2; color: #5865f2; }
  .preset-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
