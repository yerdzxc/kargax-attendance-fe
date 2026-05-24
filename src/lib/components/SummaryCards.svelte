<script lang="ts">
  let {
    totalUsers,
    totalPresent,
    totalAbsent,
    totalLeave = 0,
    totalRest = 0,
    totalHoliday = 0,
  }: {
    totalUsers: number
    totalPresent: number
    totalAbsent: number
    totalLeave?: number
    totalRest?: number
    totalHoliday?: number
  } = $props()
</script>

<div class="cards">
  <div class="card present">
    <span class="count">{totalPresent}</span>
    <span class="label">Present Today</span>
  </div>
  <div class="card absent">
    <span class="count">{totalAbsent}</span>
    <span class="label">Absent Today</span>
  </div>
  <div class="card leave">
    <span class="count">{totalLeave}</span>
    <span class="label">On Leave</span>
  </div>
  <div class="card rest">
    <span class="count">{totalRest}</span>
    <span class="label">Rest Day</span>
  </div>
  <div class="card holiday">
    <span class="count">{totalHoliday}</span>
    <span class="label">Holiday</span>
  </div>
  <div class="card total">
    <span class="count">{totalUsers}</span>
    <span class="label">Total Users</span>
  </div>
</div>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: white; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .count { display: block; font-size: 28px; font-weight: 800; line-height: 1.2; }
  .label { display: block; font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px; }
  .card.present .count { color: #22c55e; }
  .card.absent .count { color: #ef4444; }
  .card.leave .count { color: #f59e0b; }
  .card.rest .count { color: #4f46e5; }
  .card.holiday .count { color: #db2777; }
  .card.total .count { color: #333; }
</style>
