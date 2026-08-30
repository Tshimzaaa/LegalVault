import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <a href="#home" className="site-footer-logo">
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
          <p className="site-footer-tagline">
            The modern practice management platform for growing law firms — matters, clients, and documents in one
            secure workspace.
          </p>
        </div>

        <div className="site-footer-links">
          <div className="site-footer-col">
            <span className="site-footer-heading">Product</span>
            <a href="#home">Home</a>
            <a href="#about">About</a>
          </div>
          <div className="site-footer-col">
            <span className="site-footer-heading">Company</span>
            <a href="#blog">Blog</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="site-footer-col">
            <span className="site-footer-heading">Portals</span>
            <Link to="/login" state={{ staffOnly: true }}>
              Staff Login
            </Link>
            <Link to="/owner/login">Owner Portal</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span className="site-footer-copyright">&copy; {new Date().getFullYear()} Index Legal. All rights reserved.</span>
      </div>
    </footer>
  )
}

export default Footer
