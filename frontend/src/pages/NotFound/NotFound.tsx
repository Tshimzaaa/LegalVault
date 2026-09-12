import { Link, useLocation } from 'react-router-dom'
import './NotFound.css'
import Seo from '../../components/Seo'

function NotFound() {
  const location = useLocation()

  return (
    <main className="not-found-page" id="main-content">
      <Seo title="Page Not Found" description="This page doesn't exist or has moved." path={location.pathname} noindex />
      <div className="not-found-inner">
        <span className="not-found-code">404</span>
        <h1>Page Not Found</h1>
        <p>The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
        <Link to="/" className="not-found-cta">
          Back to Home
        </Link>
      </div>
    </main>
  )
}

export default NotFound
