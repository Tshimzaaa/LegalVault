import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Navbar.css'
import ThemeToggle from './ThemeToggle'

interface NavLink {
  label: string
  href: string
}

const navLinks: NavLink[] = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Blog', href: '#blog' },
  { label: 'Contact', href: '#contact' },
]

interface NavbarProps {
  onLoginClick: () => void
}

function Navbar({ onLoginClick }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    if (!menuOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header className="navbar">
      <a href="#home" className="navbar-brand" onClick={closeMenu}>
        <svg className="brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c3-1 5-4 5-7a5 5 0 0 0-5-5 3 3 0 0 1 0-6c3 0 5.5 2 7 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>LegalVault</span>
      </a>

      <nav className="navbar-links">
        {navLinks.map((link) => (
          <a key={link.href} href={link.href} className="navbar-link">
            {link.label}
          </a>
        ))}
      </nav>

      <div className="navbar-actions">
        <ThemeToggle />
        <Link to="/login" className="navbar-cta" onClick={onLoginClick}>
          Login
        </Link>
        <button
          type="button"
          className="navbar-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="navbar-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`navbar-menu-icon${menuOpen ? ' open' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div className={`navbar-mobile-backdrop${menuOpen ? ' open' : ''}`} onClick={closeMenu} />

      <nav
        id="navbar-mobile-menu"
        className={`navbar-mobile-menu${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="navbar-mobile-link"
            onClick={closeMenu}
            tabIndex={menuOpen ? undefined : -1}
          >
            {link.label}
          </a>
        ))}
        <Link
          to="/register"
          className="navbar-cta navbar-mobile-cta"
          tabIndex={menuOpen ? undefined : -1}
          onClick={closeMenu}
        >
          Get Started Free
        </Link>
        <Link
          to="/login"
          className="navbar-mobile-login"
          tabIndex={menuOpen ? undefined : -1}
          onClick={() => {
            closeMenu()
            onLoginClick()
          }}
        >
          Login
        </Link>
      </nav>
    </header>
  )
}

export default Navbar
