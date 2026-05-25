<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'

  let theme = $state('')

  onMount(() => {
    if (browser) {
      theme = localStorage.getItem('theme') || ''
      document.documentElement.className = theme
    }
  })

  function toggle() {
    theme = theme === 'dark' ? '' : 'dark'
    document.documentElement.className = theme
    localStorage.setItem('theme', theme)
  }
</script>

<button class="theme-toggle" onclick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
  {theme === 'dark' ? '☀' : '☾'}
</button>

<style>
  .theme-toggle { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font-size: 16px; color: var(--text-primary); cursor: pointer; }
  .theme-toggle:hover { opacity: 0.7; }
</style>
