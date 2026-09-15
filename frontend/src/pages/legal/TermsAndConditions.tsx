import { Link } from 'react-router-dom'
import './LegalPage.css'
import Seo from '../../components/Seo'
import Breadcrumbs from '../../components/Breadcrumbs'

function TermsAndConditions() {
  return (
    <main className="legal-page" id="main-content">
      <Seo
        title="Terms & Conditions"
        description="The terms and conditions governing use of the LegalVault practice management platform."
        path="/terms"
      />
      <div className="legal-page-inner">
        <Breadcrumbs items={[{ label: 'Terms & Conditions', path: '/terms' }]} />
        <Link to="/" className="legal-back-link">
          ← Back to home
        </Link>
        <h1>Terms and Conditions</h1>
        <p className="legal-updated">Last updated: <span className="legal-placeholder">[DATE]</span></p>

        <div className="legal-notice">
          <strong>Before you publish this:</strong> have these terms reviewed by an admitted attorney before relying
          on them commercially, especially the liability, indemnity, and governing-law sections. Placeholders are
          marked <span className="legal-placeholder">like this</span>.
        </div>

        <h2>1. Acceptance of these terms</h2>
        <p>
          These Terms and Conditions govern access to and use of the contract and practice management platform
          operated by <span className="legal-placeholder">[LegalVault (Pty) Ltd, registration no. PLACEHOLDER]</span>{' '}
          ("we", "us", the "Platform"). By creating an account, or by your organization’s staff using the Platform,
          you agree to these Terms. If you don’t agree, don’t use the Platform.
        </p>

        <h2>2. What the Platform is, and isn’t</h2>
        <p>
          The Platform is contract and practice-management software: a template library, contract tracking,
          document storage, e-signature requests, and reporting for businesses. We are a software provider, not a
          law firm. We don’t provide legal advice, don’t represent any user in any legal matter, and aren’t
          responsible for the legal accuracy or adequacy of any document, template, or contract an organization
          produces using the Platform.
        </p>

        <h2>3. Accounts and eligibility</h2>
        <ul>
          <li>Organization accounts are created directly through our self-serve signup; the organization’s administrator is responsible for managing staff access within their account.</li>
          <li>You’re responsible for keeping your login credentials confidential and for all activity under your account.</li>
          <li>Notify us immediately at <a href="mailto:hello@legalvault.example.com">hello@legalvault.example.com</a> if you suspect unauthorized access to your account.</li>
        </ul>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Platform for any unlawful purpose or in violation of any applicable law.</li>
          <li>Attempt to gain unauthorized access to another organization’s data or another user’s account.</li>
          <li>Upload malicious code, or attempt to disrupt, overload, or reverse-engineer the Platform.</li>
          <li>Use the Platform to store or transmit content you don’t have the right to share.</li>
        </ul>

        <h2>5. Your contract data and confidentiality</h2>
        <p>
          Organizations using the Platform remain responsible for the confidentiality and accuracy of the contracts
          and documents they upload, and for their own obligations to any counterparty named in them. We process
          that data only on the organization’s instructions, as described in our{' '}
          <Link to="/privacy-policy">Privacy Policy</Link>, and take the security measures described there.
        </p>

        <h2>6. Fees and payment</h2>
        <p>
          Subscription fees are arranged directly with our team and invoiced outside the Platform (there is no
          in-app billing or card processing). Fees, billing frequency, and payment terms are set out in your
          organization’s order form or agreement with us. See our <Link to="/refund-policy">Refund Policy</Link> for cancellation
          and refund terms.
        </p>

        <h2>7. Free trials</h2>
        <p>
          Where offered, a free trial gives temporary access to the Platform on these Terms. We may end or modify a
          trial at any time. Data created during a trial may not be preserved if you don’t convert to a paid plan.
        </p>

        <h2>8. Intellectual property</h2>
        <p>
          We own the Platform, its software, design, and branding. You (or your organization) retain ownership of the
          contract data, documents, and content you upload; we don’t claim ownership of it, and use it only to
          provide the service to you.
        </p>

        <h2>9. Suspension and termination</h2>
        <p>
          We may suspend or terminate access if these Terms are violated, if required by law, or for non-payment
          under your agreement with us. You may stop using the Platform at any time; your organization remains responsible
          for exporting any data it needs before an account is closed.
        </p>

        <h2>10. Service availability</h2>
        <p>
          We aim to keep the Platform available and reliable, but we don’t guarantee uninterrupted or error-free
          service. Scheduled maintenance and unplanned downtime may occur.
        </p>

        <h2>11. Disclaimers</h2>
        <p>
          The Platform is provided "as is" and "as available". To the extent permitted by law, we disclaim implied
          warranties of merchantability, fitness for a particular purpose, and non-infringement.
        </p>

        <h2>12. Limitation of liability</h2>
        <p>
          <span className="legal-placeholder">
            [Have counsel confirm the liability cap and excluded losses appropriate for your risk profile before
            publishing: a generic cap is not filled in here deliberately, since this materially affects your legal
            exposure.]
          </span>
        </p>

        <h2>13. Governing law</h2>
        <p>These Terms are governed by the laws of the Republic of South Africa, and disputes are subject to the jurisdiction of the South African courts.</p>

        <h2>14. Changes to these terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Platform after an update constitutes acceptance of the revised Terms.</p>

        <h2>15. Contact us</h2>
        <p>
          Email: <a href="mailto:hello@legalvault.example.com">hello@legalvault.example.com</a> &nbsp;·&nbsp; Phone:{' '}
          <a href="tel:+27115550134">+27 11 555 0134</a> &nbsp;·&nbsp; Address: 12 Fredman Drive,
          Sandton, Johannesburg, 2196, South Africa
        </p>
      </div>
    </main>
  )
}

export default TermsAndConditions
