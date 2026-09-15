import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <Link to="/" className="site-footer-logo">
            <svg className="brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c3-1 5-4 5-7a5 5 0 0 0-5-5 3 3 0 0 1 0-6c3 0 5.5 2 7 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span>LegalVault</span>
          </Link>
          <p className="site-footer-tagline">
            An online contract library and practice management platform for businesses: ready-to-execute templates,
            contracting guidance, and step-by-step tools to conclude agreements.
          </p>
        </div>

        <div className="site-footer-links">
          <div className="site-footer-col">
            <span className="site-footer-heading">Product</span>
            <Link to="/">Home</Link>
            <Link to="/#about">About</Link>
          </div>
          <div className="site-footer-col">
            <span className="site-footer-heading">Company</span>
            <Link to="/#blog">Blog</Link>
            <Link to="/#contact">Contact</Link>
          </div>
          <div className="site-footer-col">
            <span className="site-footer-heading">Portals</span>
            <Link to="/login">
              Login
            </Link>
            <Link to="/owner/login">Owner Portal</Link>
          </div>
          <div className="site-footer-col">
            <span className="site-footer-heading">Legal</span>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms">Terms &amp; Conditions</Link>
            <Link to="/cookie-policy">Cookie Policy</Link>
            <Link to="/refund-policy">Refund Policy</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span className="site-footer-copyright">
          &copy; {new Date().getFullYear()} LegalVault (Pty) Ltd. All rights reserved.
        </span>
        <span className="site-footer-address">12 Fredman Drive, Sandton, Johannesburg, 2196, South Africa</span>
      </div>
    </footer>
  )
}

export default Footer
