<script lang="ts">
  let {
    totalUsers,
    totalPresent,
    totalAbsent,
    totalLeave = 0,
    totalRest = 0,
    totalHoliday = 0,
    totalLate = 0,
    totalOT = 0,
    periodPresent = 0,
    periodAbsent = 0,
    periodLate = 0,
    periodLeave = 0,
    periodRest = 0,
  }: {
    totalUsers: number
    totalPresent: number
    totalAbsent: number
    totalLeave?: number
    totalRest?: number
    totalHoliday?: number
    totalLate?: number
    totalOT?: number
    periodPresent?: number
    periodAbsent?: number
    periodLate?: number
    periodLeave?: number
    periodRest?: number
  } = $props()
</script>

<div class="section-label">Today</div>
<div class="cards">
  <div class="card present">
    <span class="count">{totalPresent}</span>
    <span class="label">Present Today</span>
  </div>
  <div class="card absent">
    <span class="count">{totalAbsent}</span>
    <span class="label">Absent Today</span>
  </div>
  <div class="card late">
    <span class="count">{totalLate}</span>
    <span class="label">Late Today</span>
  </div>
  <div class="card ot">
    <span class="count">{totalOT}</span>
    <span class="label">Overtime Today</span>
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

<div class="section-label">This Period</div>
<div class="cards">
  <div class="card present">
    <span class="count">{periodPresent}</span>
    <span class="label">Present</span>
  </div>
  <div class="card absent">
    <span class="count">{periodAbsent}</span>
    <span class="label">Absences</span>
  </div>
  <div class="card late">
    <span class="count">{periodLate}</span>
    <span class="label">Late Entries</span>
  </div>
  <div class="card leave">
    <span class="count">{periodLeave}</span>
    <span class="label">Leave Days</span>
  </div>
  <div class="card rest">
    <span class="count">{periodRest}</span>
    <span class="label">Rest Days</span>
  </div>
</div>

<style>
  .section-label { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: var(--bg-card); border-radius: 10px; padding: 16px; text-align: center; border: 1px solid var(--border); box-shadow: var(--shadow); }
  .count { display: block; font-size: 28px; font-weight: 800; line-height: 1.2; }
  .label { display: block; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px; }
  .card.present .count { color: #22c55e; }
  .card.absent .count { color: #ef4444; }
  .card.late .count { color: #d97706; }
  .card.ot .count { color: #2563eb; }
  .card.leave .count { color: #f59e0b; }
  .card.rest .count { color: #4f46e5; }
  .card.holiday .count { color: #db2777; }
  .card.total .count { color: #333; }
</style>
