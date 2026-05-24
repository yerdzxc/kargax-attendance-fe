<script lang="ts">
  let {
    totalUsers,
    totalPresent,
    totalAbsent,
  }: { totalUsers: number; totalPresent: number; totalAbsent: number } = $props()
</script>

<div class="summary">
  <div class="card present">
    <span class="label">Total Employees</span>
    <span class="value">{totalUsers}</span>
  </div>
  <div class="card present">
    <span class="label">Present</span>
    <span class="value today">{totalPresent}</span>
  </div>
  <div class="card absent">
    <span class="label">Absent</span>
    <span class="value">{totalAbsent}</span>
  </div>
</div>

<style>
  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    border: 1px solid #eee;
  }
  .label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .value {
    font-size: 28px;
    font-weight: 700;
    color: #333;
  }
  .value.today {
    color: #22c55e;
  }
  .absent .value {
    color: #ef4444;
  }
</style>
