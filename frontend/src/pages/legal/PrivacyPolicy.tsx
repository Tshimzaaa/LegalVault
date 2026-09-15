import { Link } from 'react-router-dom'
import './LegalPage.css'
import Seo from '../../components/Seo'
import Breadcrumbs from '../../components/Breadcrumbs'

function PrivacyPolicy() {
  return (
    <main className="legal-page" id="main-content">
      <Seo
        title="Privacy Policy"
        description="How LegalVault collects, uses, and protects personal information under South Africa’s POPIA."
        path="/privacy-policy"
      />
      <div className="legal-page-inner">
        <Breadcrumbs items={[{ label: 'Privacy Policy', path: '/privacy-policy' }]} />
        <Link to="/" className="legal-back-link">
          ← Back to home
        </Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: <span className="legal-placeholder">[DATE]</span></p>

        <div className="legal-notice">
          <strong>Before you publish this:</strong> this policy is drafted for South African law (POPIA) and is a
          starting point, not a substitute for review by an admitted attorney. Fields marked{' '}
          <span className="legal-placeholder">like this</span> are placeholders: replace them with your real
          registered entity name, address, registration number, and Information Officer details before this page
          goes live.
        </div>

        <h2>1. Who we are</h2>
        <p>
          This Privacy Policy explains how <span className="legal-placeholder">[LegalVault (Pty) Ltd, registration
          no. PLACEHOLDER]</span> ("we", "us", "LegalVault") collects, uses, and protects personal information when
          you visit our website or use our contract and practice management platform as an organization or a
          member of its staff.
        </p>
        <p>
          Registered address: 12 Fredman Drive, Sandton, Johannesburg, 2196, South Africa (
          <span className="legal-placeholder">confirm this is your real registered address</span>).
        </p>
        <p>
          We process personal information in accordance with the Protection of Personal Information Act 4 of 2013
          ("POPIA").
        </p>

        <h2>2. Two roles we play</h2>
        <p>
          Depending on the data in question, we act in one of two capacities under POPIA:
        </p>
        <ul>
          <li>
            <strong>Responsible party</strong>: for information about our website visitors, prospective customers,
            and staff accounts (name, email, login activity), where we decide why and how it’s processed.
          </li>
          <li>
            <strong>Operator</strong>: for personal information an organization using our platform uploads as part
            of its own contracts and documents (which may include details of counterparties or other third
            parties). The organization is the responsible party for that data; we only process it on the
            organization’s instructions, under a data processing agreement with that organization.
          </li>
        </ul>

        <h2>3. What we collect</h2>
        <h3>Website visitors</h3>
        <ul>
          <li>Contact form submissions: name, work email, organization name, and message content.</li>
          <li>Basic technical data your browser sends to any website (IP address, browser type) via standard server logs.</li>
        </ul>
        <h3>Staff and SaaS-owner accounts</h3>
        <ul>
          <li>Name, email address, role, and a securely hashed password (we never store passwords in plain text).</li>
          <li>Login activity and actions taken in the platform, kept in an audit log for security and accountability.</li>
        </ul>
        <p>We only ask website and account forms for the information needed to provide the service; we don’t request data we don’t need.</p>

        <h2>4. How we use it</h2>
        <ul>
          <li>To create and secure your account, and authenticate you when you log in.</li>
          <li>To operate core features: contracts, documents, templates, e-signatures, and reporting.</li>
          <li>To respond to enquiries submitted through our contact form.</li>
          <li>To send operational emails (e.g. invitations, password resets, deadline reminders).</li>
          <li>To detect, investigate, and prevent security incidents, fraud, and misuse.</li>
          <li>To comply with legal obligations.</li>
        </ul>
        <p>We do not sell personal information, and we do not use it for targeted advertising.</p>

        <h2>5. Cookies and local storage</h2>
        <p>
          We don’t use tracking or advertising cookies, and we don’t run third-party analytics on this site. To keep
          you signed in, the app stores your session token in your browser’s <strong>local storage</strong> (not a
          cookie); this is strictly necessary for the service to function. See our{' '}
          <Link to="/cookie-policy">Cookie Policy</Link> for details.
        </p>

        <h2>6. Who we share it with</h2>
        <p>We share personal information only with service providers who help us run the platform, under contract, and only to the extent needed:</p>
        <ul>
          <li>Cloud database and file storage providers (for hosting contracts, documents, and account data).</li>
          <li>Our e-signature provider, to process signature requests you initiate.</li>
          <li>Malware-scanning services, to check uploaded files for threats.</li>
          <li>An error-monitoring service, to help us fix bugs (technical error data only, disabled by default).</li>
          <li>Our hosting provider(s) for the website and application.</li>
        </ul>
        <p>
          <span className="legal-placeholder">
            [List each named sub-processor here (e.g. Neon, Cloudflare, Documenso, Render, Sentry, your email
            provider) with the country each stores data in]
          </span>{' '}
          is required detail for a compliant POPIA notice.
        </p>

        <h2>7. Cross-border transfers</h2>
        <p>
          Some of our service providers may store or process data outside South Africa. Where that happens, we take
          steps required by POPIA section 72 to ensure the recipient is subject to comparable data protection
          obligations before transferring personal information there.{' '}
          <span className="legal-placeholder">[Confirm which providers/countries this applies to]</span>.
        </p>

        <h2>8. How long we keep it</h2>
        <p>
          We keep account and contract data for as long as your organization’s account is active, plus a reasonable period
          afterward to meet legal, accounting, or dispute-resolution needs. Contact form submissions are kept only
          as long as needed to respond to and resolve the enquiry.
        </p>

        <h2>9. Security</h2>
        <p>
          Passwords are hashed with argon2id, data in transit is encrypted, uploaded files are scanned for malware,
          and access to each organization’s data is isolated using row-level security in our database, on top of
          application-level access controls and an audit log.
        </p>

        <h2>10. Your rights</h2>
        <p>Under POPIA, you have the right to:</p>
        <ul>
          <li>Ask us to confirm what personal information we hold about you, and access it.</li>
          <li>Ask us to correct or delete inaccurate, irrelevant, excessive, or unlawfully obtained information.</li>
          <li>Object to the processing of your personal information on reasonable grounds.</li>
          <li>Withdraw consent, where processing is based on consent, without affecting prior lawful processing.</li>
          <li>
            Lodge a complaint with the Information Regulator (South Africa) if you believe we’ve mishandled your
            information: <a href="https://inforegulator.org.za" target="_blank" rel="noreferrer">inforegulator.org.za</a>.
          </li>
        </ul>
        <p>
          To exercise these rights, contact our Information Officer at{' '}
          <span className="legal-placeholder">[privacy@yourcompany.com]</span>.
        </p>

        <h2>11. Information Officer</h2>
        <p>
          <span className="legal-placeholder">
            [Name of Information Officer], registered with the Information Regulator as required by POPIA
          </span>
          . Contact: <span className="legal-placeholder">[email/phone]</span>.
        </p>

        <h2>12. Children’s information</h2>
        <p>This platform is intended for use by organizations and their authorized adult staff; it is not directed at children.</p>

        <h2>13. Changes to this policy</h2>
        <p>We’ll update this page when our practices change and update the "last updated" date above.</p>

        <h2>14. Contact us</h2>
        <p>
          Email: <a href="mailto:hello@legalvault.example.com">hello@legalvault.example.com</a> &nbsp;·&nbsp; Phone:{' '}
          <a href="tel:+27115550134">+27 11 555 0134</a> &nbsp;·&nbsp; Address: 12 Fredman Drive,
          Sandton, Johannesburg, 2196, South Africa
        </p>
      </div>
    </main>
  )
}

export default PrivacyPolicy
