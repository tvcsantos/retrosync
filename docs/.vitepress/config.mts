import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'RetroSync',
  description: 'A desktop app for managing retro game ROM libraries',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/architecture' },
      { text: 'Addon Dev', link: '/addon-development' },
      { text: 'Contributing', link: '/contributing' },
      { text: 'GitHub', link: 'https://github.com/tvcsantos/retrosync' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Contributing', link: '/contributing' }
        ]
      },
      {
        text: 'Addons',
        items: [{ text: 'Addon Development', link: '/addon-development' }]
      }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/tvcsantos/retrosync' }],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Tiago Santos'
    }
  }
})
