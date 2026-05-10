import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms'

export default withMermaid(
  defineConfig({
    title: 'RetroSync',
    description: 'A desktop app for managing retro game ROM libraries',
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
        { text: 'Guide', link: '/architecture' },
        { text: 'Addon Dev', link: '/addon-development' },
        { text: 'Contributing', link: '/contributing' }
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
        copyright: 'Copyright © 2025-present Tiago Santos'
      }
    }
  })
)
