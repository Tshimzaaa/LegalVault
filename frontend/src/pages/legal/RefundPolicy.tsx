import { Link } from 'react-router-dom'
import './LegalPage.css'
import Seo from '../../components/Seo'
import Breadcrumbs from '../../components/Breadcrumbs'

function RefundPolicy() {
  return (
    <main className="legal-page" id="main-content">
      <Seo
        title="Billing & Refund Policy"
        description="Index Legal’s billing and refund policy for law firm subscriptions."
        path="/refund-policy"
      />
      <div className="legal-page-inner">
        <Breadcrumbs items={[{ label: 'Billing & Refund Policy', path: '/refund-policy' }]} />
        <Link to="/" className="legal-back-link">
          ← Back to home
        </Link>
        <h1>Billing &amp; Refund Policy</h1>
        <p className="legal-updated">Last updated: <span className="legal-placeholder">[DATE]</span></p>

        <div className="legal-notice">
          <strong>Before you publish this:</strong> we don’t process payments in-app; fees are arranged directly
          with your firm and invoiced outside the Platform. Fill in the placeholders below with your actual
          commercial terms (cancellation notice period, proration approach, etc.) before publishing.
        </div>

        <h2>How billing works</h2>
        <p>
          Subscription fees aren’t collected through the Platform. Instead, they’re agreed directly with our team
          and paid by bank transfer or invoice, per the order form or agreement signed with your firm. No card
          details are collected or stored by the Platform.
        </p>

        <h2>Free trials</h2>
        <p>
          Where a free trial is offered, you won’t be charged during the trial period, and no payment method is
          required to start one.
        </p>

        <h2>Cancellations</h2>
        <p>
          You may cancel your subscription at any time by contacting{' '}
          <span className="legal-placeholder">[billing@yourcompany.com]</span>: cancellation takes effect at the
          end of the current billing period referenced in your agreement, unless otherwise agreed.
        </p>

        <h2>Refunds</h2>
        <p>
          <span className="legal-placeholder">
            [State your real refund terms here, for example: refunds are considered case-by-case for billing
            errors or service failures on our part, and are not provided for partial billing periods or unused
            time. Confirm this against your actual agreement and, if selling to consumers, check whether South
            Africa’s Consumer Protection Act cooling-off provisions apply to your offering.]
          </span>
        </p>

        <h2>Billing disputes</h2>
        <p>
          If you believe you’ve been invoiced incorrectly, contact us at{' '}
          <span className="legal-placeholder">[billing@yourcompany.com]</span> within{' '}
          <span className="legal-placeholder">[30]</span> days of the invoice date and we’ll investigate.
        </p>

        <h2>Related policies</h2>
        <p>
          See our <Link to="/terms">Terms and Conditions</Link> and <Link to="/privacy-policy">Privacy Policy</Link>{' '}
          for how we handle your account and data.
        </p>

        <h2>Contact us</h2>
        <p>Email: hello@indexlegal.com &nbsp;·&nbsp; Phone: +27 11 555 0134</p>
      </div>
    </main>
  )
}

export default RefundPolicy
