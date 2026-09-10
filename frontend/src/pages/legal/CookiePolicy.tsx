import { Link } from 'react-router-dom'
import './LegalPage.css'
import Seo from '../../components/Seo'
import Breadcrumbs from '../../components/Breadcrumbs'

function CookiePolicy() {
  return (
    <main className="legal-page" id="main-content">
      <Seo
        title="Cookie Policy"
        description="How Index Legal uses cookies and local storage on its website and platform."
        path="/cookie-policy"
      />
      <div className="legal-page-inner">
        <Breadcrumbs items={[{ label: 'Cookie Policy', path: '/cookie-policy' }]} />
        <Link to="/" className="legal-back-link">
          ← Back to home
        </Link>
        <h1>Cookie Policy</h1>
        <p className="legal-updated">Last updated: <span className="legal-placeholder">[DATE]</span></p>

        <h2>Short version</h2>
        <p>
          We don't use tracking, advertising, or analytics cookies on this site, and we don't run third-party
          tracking scripts. That's why you won't see a cookie-consent banner: there's nothing non-essential to ask
          your consent for.
        </p>

        <h2>What we actually store</h2>
        <p>
          When you log in, the app stores a short-lived session token in your browser's{' '}
          <strong>local storage</strong> (a browser storage mechanism, not a cookie) so you stay signed in as you
          navigate the app. This is strictly necessary for the Platform to function; without it, you'd be logged
          out on every page.
        </p>
        <ul>
          <li><strong>What:</strong> an access token, a refresh token, and which type of account you're signed in as.</li>
          <li><strong>Why:</strong> to keep you authenticated and route you to the right portal.</li>
          <li><strong>Where:</strong> stored only in your browser, on your device; not shared with third parties.</li>
          <li><strong>How long:</strong> cleared when you log out, or when a token expires.</li>
        </ul>

        <h2>Under South African and EU rules</h2>
        <p>
          Storage that's strictly necessary to provide a service you've requested (like staying logged in) is
          generally exempt from cookie-consent requirements under both South Africa's POPIA and the EU/UK
          ePrivacy rules, which is why no consent banner is shown. See our <Link to="/privacy-policy">Privacy
          Policy</Link> for how we handle personal information more broadly.
        </p>

        <h2>If this changes</h2>
        <p>
          If we ever add analytics, marketing, or third-party tracking cookies, we'll update this page and add a
          consent banner before any non-essential cookie is set, not after.
        </p>

        <h2>Controlling local storage</h2>
        <p>
          You can clear local storage at any time through your browser's site settings or developer tools; doing so
          will simply log you out.
        </p>

        <h2>Contact us</h2>
        <p>Email: hello@indexlegal.com</p>
      </div>
    </main>
  )
}

export default CookiePolicy
