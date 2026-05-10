<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useData } from 'vitepress'

interface Asset {
  name: string
  browser_download_url: string
  size: number
}

interface PlatformDownload {
  os: string
  label: string
  iconSrc: string
  darkInvert?: boolean
  asset: Asset | null
  altAsset?: Asset | null
  altLabel?: string
}

const { isDark } = useData()

const REPO = 'tvcsantos/retrosync'
const DEVICON_CDN = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons'

const platforms = ref<PlatformDownload[]>([])
const version = ref<string | null>(null)
const loading = ref(true)
const error = ref(false)

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function matchAsset(
  assets: Asset[],
  ext: string,
  include?: string,
  exclude?: string
): Asset | null {
  return (
    assets.find((a) => {
      const name = a.name.toLowerCase()
      if (!name.endsWith(ext)) return false
      if (include && !name.includes(include)) return false
      if (exclude && name.includes(exclude)) return false
      return true
    }) ?? null
  )
}

onMounted(async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const assets: Asset[] = data.assets ?? []
    version.value = data.tag_name ?? null

    platforms.value = [
      {
        os: 'macos-arm',
        label: 'macOS (Apple Silicon)',
        iconSrc: `${DEVICON_CDN}/apple/apple-original.svg`,
        darkInvert: true,
        asset: matchAsset(assets, '.dmg', 'arm64')
      },
      {
        os: 'macos-x64',
        label: 'macOS (Intel)',
        iconSrc: `${DEVICON_CDN}/apple/apple-original.svg`,
        darkInvert: true,
        asset: matchAsset(assets, '.dmg', undefined, 'arm64')
      },
      {
        os: 'windows',
        label: 'Windows',
        iconSrc: `${DEVICON_CDN}/windows11/windows11-original.svg`,
        asset: matchAsset(assets, '.exe')
      },
      {
        os: 'linux',
        label: 'Linux',
        iconSrc: `${DEVICON_CDN}/linux/linux-original.svg`,
        asset: matchAsset(assets, '.appimage'),
        altAsset: matchAsset(assets, '.deb'),
        altLabel: '.deb'
      }
    ]
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="dl-loading">Loading latest release...</div>

  <!-- Error / no release -->
  <div v-else-if="error" class="dl-fallback">
    <p>
      Could not fetch the latest release. Download directly from
      <a :href="`https://github.com/${REPO}/releases/latest`" target="_blank" rel="noopener">
        GitHub Releases</a
      >.
    </p>
  </div>

  <!-- Cards -->
  <div v-else class="dl-grid">
    <div v-for="p in platforms" :key="p.os" class="dl-card">
      <div class="dl-icon">
        <img
          :src="p.iconSrc"
          :alt="p.label"
          :style="p.darkInvert && isDark ? { filter: 'invert(1)' } : undefined"
          width="36"
          height="36"
        />
      </div>
      <div class="dl-info">
        <span class="dl-label">{{ p.label }}</span>
        <span v-if="p.asset" class="dl-meta">{{ p.asset.name }} ({{ formatSize(p.asset.size) }})</span>
        <span v-else class="dl-meta dl-unavailable">Not available</span>
      </div>
      <div class="dl-actions">
        <a
          v-if="p.asset"
          :href="p.asset.browser_download_url"
          class="dl-btn dl-btn-primary"
          target="_blank"
          rel="noopener"
        >
          Download
        </a>
        <a
          v-if="p.altAsset"
          :href="p.altAsset.browser_download_url"
          class="dl-btn dl-btn-secondary"
          target="_blank"
          rel="noopener"
        >
          {{ p.altLabel }}
        </a>
      </div>
    </div>
  </div>

  <p v-if="!loading && !error && version" class="dl-version">
    Latest: <strong>{{ version }}</strong> &mdash;
    <a :href="`https://github.com/${REPO}/releases/latest`" target="_blank" rel="noopener">
      View all releases
    </a>
  </p>
</template>

<style scoped>
.dl-loading {
  text-align: center;
  padding: 24px;
  color: var(--vp-c-text-2);
}

.dl-fallback {
  text-align: center;
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.dl-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 640px) {
  .dl-grid {
    grid-template-columns: 1fr;
  }
}

.dl-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.25s, box-shadow 0.25s;
}

.dl-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.08);
}

.dl-icon img {
  display: block;
}

.dl-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dl-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.dl-meta {
  font-size: 12px;
  color: var(--vp-c-text-3);
  text-align: center;
  word-break: break-all;
}

.dl-unavailable {
  font-style: italic;
}

.dl-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.dl-btn {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.25s;
}

.dl-btn:hover {
  opacity: 0.85;
}

.dl-btn-primary {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.dl-btn-primary:hover {
  color: #fff;
}

.dl-btn-secondary {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.dl-btn-secondary:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

.dl-version {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
</style>
