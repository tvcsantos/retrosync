import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms'

const rawBase = process.env.BASE_URL || '/'
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

export default withMermaid(
  defineConfig({
    base,
    title: 'RetroSync',
    description: 'A desktop app for managing retro game ROM libraries',
    head: [['link', { rel: 'icon', href: `${base}favicon.ico` }]],
    vite: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [llmstxt() as any]
    },
    markdown: {
      config(md) {
        md.use(copyOrDownloadAsMarkdownButtons)
      }
    },
    mermaid: {
      theme: 'neutral'
    },
    themeConfig: {
      nav: [
        { text: 'Get Started', link: '/get-started' },
        { text: 'Architecture', link: '/architecture' },
        { text: 'Addon Dev', link: '/addon-development' },
        { text: 'Contributing', link: '/contributing' },
        { text: 'Changelog', link: '/changelog' }
      ],
      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Get Started', link: '/get-started' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Contributing', link: '/contributing' }
          ]
        },
        {
          text: 'Addons',
          items: [{ text: 'Addon Development', link: '/addon-development' }]
        },
        {
          text: 'Project',
          items: [{ text: 'Changelog', link: '/changelog' }]
        }
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/tvcsantos/retrosync' }],
      search: {
        provider: 'local'
      },
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2025-present Tiago Santos'
      }
    }
  })
)
