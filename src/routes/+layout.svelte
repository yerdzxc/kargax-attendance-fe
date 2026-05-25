<script lang="ts">
  import '../app.css'
  import ThemeToggle from '$lib/components/ThemeToggle.svelte'
  let { children }: { children: any } = $props()
</script>

<div class="nav">
  <a href="/">KargaX Attendance</a>
  <ThemeToggle />
</div>

{@render children()}
