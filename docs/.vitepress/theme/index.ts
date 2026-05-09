/* eslint-disable react-hooks/rules-of-hooks */
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute, inBrowser } from 'vitepress'
// @ts-expect-error -- lightbox3 types don't cover the style.css export
import 'lightbox3/style.css'
import { Lightbox } from 'lightbox3'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    const initLightbox = (): void => {
      if (!inBrowser) return

      // Wrap each doc image in a lightbox-enabled anchor
      document.querySelectorAll('.vp-doc img').forEach((img) => {
        const el = img as HTMLImageElement
        // Skip if already wrapped
        if (el.parentElement?.hasAttribute('data-lightbox')) return

        const a = document.createElement('a')
        a.href = el.src
        a.setAttribute('data-lightbox', 'docs')
        a.setAttribute('data-caption', el.alt || '')
        el.parentElement?.insertBefore(a, el)
        a.appendChild(el)
      })

      Lightbox.init()
    }

    onMounted(initLightbox)
    watch(
      () => route.path,
      () => nextTick(initLightbox)
    )
  }
} satisfies Theme
