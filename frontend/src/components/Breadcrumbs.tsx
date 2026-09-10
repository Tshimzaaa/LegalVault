import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Breadcrumbs.css'
import { SITE_URL } from '../constants/site'

export interface Crumb {
  label: string
  path: string
}

interface BreadcrumbsProps {
  items: Crumb[]
}

/** Visible "Home > X" trail plus matching BreadcrumbList JSON-LD for every non-home page. */
function Breadcrumbs({ items }: BreadcrumbsProps) {
  const trail: Crumb[] = [{ label: 'Home', path: '/' }, ...items]

  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-seo', 'breadcrumb')
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.label,
        item: `${SITE_URL}${crumb.path}`,
      })),
    })
    document.head.appendChild(script)
    return () => script.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((crumb, i) => (
          <li key={crumb.path}>
            {i === trail.length - 1 ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link to={crumb.path}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
