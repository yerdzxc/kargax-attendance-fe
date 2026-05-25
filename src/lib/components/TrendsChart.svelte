<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Chart, registerables } from 'chart.js'
  import type { UserAttendance } from '$lib/types'

  Chart.register(...registerables)

  let {
    users,
    dates,
  }: {
    users: UserAttendance[]
    dates: string[]
  } = $props()

  let canvas: HTMLCanvasElement
  let chart: Chart | null = null

  function buildChart() {
    if (!canvas) return
    if (chart) chart.destroy()

    const labels = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00')
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    const present = dates.map((date) => users.filter((u) => u.days.find((d) => d.date === date)?.present).length)
    const absent = dates.map((date) => users.filter((u) => u.days.find((d) => d.date === date)?.status === 'absent').length)
    const late = dates.map((date) => users.filter((u) => u.days.find((d) => d.date === date)?.status === 'late').length)
    const leave = dates.map((date) => users.filter((u) => u.days.find((d) => d.date === date)?.status === 'leave').length)

    const isDark = document.documentElement.classList.contains('dark')
    const gridColor = isDark ? '#2d2d44' : '#e5e7eb'
    const textColor = isDark ? '#94a3b8' : '#888'

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Present', data: present, backgroundColor: '#22c55e80', borderColor: '#22c55e', borderWidth: 1 },
          { label: 'Late', data: late, backgroundColor: '#d9770680', borderColor: '#d97706', borderWidth: 1 },
          { label: 'Absent', data: absent, backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 },
          { label: 'Leave', data: leave, backgroundColor: '#f59e0b80', borderColor: '#f59e0b', borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor, font: { size: 11 } } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, stepSize: 1 } },
        },
      },
    })
  }

  const darkObserver = $derived(
    typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
      ? new MutationObserver(() => buildChart())
      : null
  )

  onMount(() => {
    buildChart()
    const observer = new MutationObserver(() => buildChart())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  })

  onDestroy(() => {
    if (chart) chart.destroy()
  })

  $effect(() => {
    if (users && dates) buildChart()
  })
</script>

<div class="chart-wrap">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-wrap { height: 250px; margin-bottom: 20px; }
</style>
