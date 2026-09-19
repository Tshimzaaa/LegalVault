import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Sidebar.css'
import { IconDots, IconLeaf, IconPlus, IconSearch, IconX } from './icons'
import ThemeToggle from './ThemeToggle'

export interface NavItem {
  label: string
  icon: React.ReactNode
  page: string
}

export interface SidebarUser {
  first_name: string
  last_name: string
  email: string
}

interface SidebarProps {
  activePage: string
  /** Route prefix each nav item's page is appended to, e.g. "/staff". */
  basePath: string
  navItems: NavItem[]
  user: SidebarUser
  onLogout: () => void
  brandName?: string
  brandSub?: string
  notificationBell?: React.ReactNode
  /** Page keys shown as bottom tabs on phones; everything else lives in the "More" sheet. */
  mobileTabs?: string[]
  /** One of `mobileTabs` rendered as the raised primary action in the tab bar. */
  mobileAction?: string
}

function Sidebar({
  activePage,
  basePath,
  navItems,
  user,
  onLogout,
  brandName = 'LegalVault',
  brandSub = 'contract management platform',
  notificationBell,
  mobileTabs,
  mobileAction,
}: SidebarProps) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const hasTabs = !!mobileTabs?.length
  const tabItems = (mobileTabs ?? [])
    .map((page) => navItems.find((item) => item.page === page))
    .filter((item): item is NavItem => !!item)
  const moreActive = hasTabs && !tabItems.some((item) => item.page === activePage)
  const hasSearch = navItems.some((item) => item.page === 'search')
  // The sidebar is only off-canvas below this breakpoint (see Sidebar.css) — above it, it's
  // always visible regardless of `open`, so its links must stay focusable there even when
  // `open` is false. Tracked via matchMedia so the tabIndex logic below matches the CSS exactly.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 880px)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 880px)')
    const onChange = () => setIsMobile(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const close = () => setOpen(false)

  useEffect(() => {
    if (open && isMobile) closeRef.current?.focus()
  }, [open, isMobile])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <>
      <div className={`sidebar-mobile-bar${hasTabs ? ' has-tabs' : ''}`}>
        {!hasTabs && (
          <button
            type="button"
            className="sidebar-mobile-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="dash-sidebar"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`sidebar-menu-icon${open ? ' open' : ''}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        )}
        <span className="sidebar-mobile-brand">
          <span className="brand-mark">
            <IconLeaf />
          </span>
          <span className="brand-name">{brandName}</span>
        </span>
        {hasTabs && hasSearch && (
          <Link to={`${basePath}/search`} className="sidebar-mobile-search" aria-label="Search">
            <IconSearch />
          </Link>
        )}
        {notificationBell && (
          <span className={`sidebar-mobile-bell${hasTabs && hasSearch ? ' after-search' : ''}`}>{notificationBell}</span>
        )}
      </div>

      <div className={`sidebar-backdrop${open ? ' open' : ''}`} onClick={close} />

      <aside id="dash-sidebar" className={`dash-sidebar${open ? ' open' : ''}`} aria-hidden={isMobile && !open}>
        <div className="sheet-header">
          <span className="sheet-grabber" aria-hidden="true" />
          <span className="sheet-title">Menu</span>
          <button
            type="button"
            ref={closeRef}
            className="sheet-close"
            aria-label="Close menu"
            tabIndex={isMobile && !open ? -1 : undefined}
            onClick={close}
          >
            <IconX />
          </button>
        </div>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <IconLeaf />
          </span>
          <span className="brand-text">
            <span className="brand-name">{brandName}</span>
            <span className="brand-sub">{brandSub}</span>
          </span>
          {notificationBell && <span className="sidebar-brand-bell">{notificationBell}</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const active = item.page === activePage
            return (
              <Link
                key={item.label}
                to={`${basePath}/${item.page}`}
                className={`nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
                tabIndex={isMobile && !open ? -1 : undefined}
                onClick={close}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-account">
          <div className="account-info">
            <span className="account-name">
              {user.first_name} {user.last_name}
            </span>
            <span className="account-email">{user.email}</span>
          </div>
          <div className="account-actions">
            <ThemeToggle />
            <button
              type="button"
              className="account-logout"
              tabIndex={isMobile && !open ? -1 : undefined}
              onClick={onLogout}
            >
              Log Out
            </button>
          </div>
        </div>
      </aside>
      {hasTabs && (
        <nav className="mobile-tabbar" aria-label="Primary">
          {tabItems.map((item) => {
            const active = item.page === activePage
            const isAction = item.page === mobileAction
            return (
              <Link
                key={item.page}
                to={`${basePath}/${item.page}`}
                className={`mobile-tab${active ? ' active' : ''}${isAction ? ' action' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={close}
              >
                <span className="mobile-tab-icon">{isAction ? <IconPlus /> : item.icon}</span>
                <span className="mobile-tab-label">{isAction ? 'New' : item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            className={`mobile-tab${moreActive || open ? ' active' : ''}`}
            aria-expanded={open}
            aria-controls="dash-sidebar"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="mobile-tab-icon">
              <IconDots />
            </span>
            <span className="mobile-tab-label">More</span>
          </button>
        </nav>
      )}
    </>
  )
}

export default Sidebar
