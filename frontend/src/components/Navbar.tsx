import './Navbar.css'

interface NavbarProps {
  onLoginClick: () => void
}

function Navbar({ onLoginClick }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <svg className="brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c3-1 5-4 5-7a5 5 0 0 0-5-5 3 3 0 0 1 0-6c3 0 5.5 2 7 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Index</span>
      </div>

      <nav className="navbar-links">
        <a href="#home">Home</a>
        <a href="#pages" className="has-caret">
          All Pages <span className="caret">▾</span>
        </a>
        <a href="#pricing">Pricing</a>
        <a href="#blog">Blog</a>
        <a href="#contact">Contact</a>
      </nav>

      <button type="button" className="navbar-cta" onClick={onLoginClick}>
        Login
      </button>
    </header>
  )
}

export default Navbar
