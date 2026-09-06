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
  return (
    <header className="navbar">
      <a href="#home" className="navbar-brand">
        <svg className="brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c3-1 5-4 5-7a5 5 0 0 0-5-5 3 3 0 0 1 0-6c3 0 5.5 2 7 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Index</span>
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
        <button type="button" className="navbar-cta" onClick={onLoginClick}>
          Login
        </button>
      </div>
    </header>
  )
}

export default Navbar
