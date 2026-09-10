import { useEffect } from 'react'
import { SITE_NAME, SITE_URL } from '../constants/site'

interface SeoProps {
  title: string
  description: string
  path: string
  image?: string
  noindex?: boolean
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"][data-seo]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    el.setAttribute('data-seo', '')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.querySelector(`meta[${attr}="${key}"][data-seo]`)?.remove()
}

function upsertCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"][data-seo]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    el.setAttribute('data-seo', '')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Sets per-page <title>/meta/canonical/OG tags on mount. Client-side only: Google
 * executes this, but not every bot/link-unfurler does; index.html's static defaults
 * cover the pre-JS case. See constants/site.ts and the plan's "known limitation" note.
 */
function Seo({ title, description, path, image, noindex }: SeoProps) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`
    const url = `${SITE_URL}${path}`
    const ogImage = image ?? `${SITE_URL}/og-image.png`

    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertCanonical(url)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', ogImage)

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow')
    } else {
      removeMeta('name', 'robots')
    }
  }, [title, description, path, image, noindex])

  return null
}

export default Seo
