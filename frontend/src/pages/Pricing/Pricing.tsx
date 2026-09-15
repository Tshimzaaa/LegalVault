import { Link } from 'react-router-dom'
import './Pricing.css'

interface Plan {
  name: string
  price: number | null
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
  ctaHref: string
}

const currencyFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 1499,
    period: '/ month',
    description: 'For solo practitioners getting organized.',
    features: [
      'Up to 25 active contracts',
      'Client portal access',
      'Document storage (10GB)',
      'Document templates & e-signatures',
      'Email support',
    ],
    cta: 'Start free trial',
    ctaHref: '/register',
  },
  {
    name: 'Professional',
    price: 3299,
    period: '/ month',
    description: 'For growing firms that need more workflow.',
    features: [
      'Unlimited active contracts',
      'Client portal + e-signatures',
      'Document storage (100GB)',
      'Workflow automation',
      'Reporting & CSV export',
      'Priority support',
    ],
    highlighted: true,
    cta: 'Start free trial',
    ctaHref: '/register',
  },
  {
    name: 'Firm',
    price: null,
    period: 'pricing',
    description: 'For multi-partner firms with larger teams.',
    features: [
      'Everything in Professional',
      'Unlimited storage',
      'Custom roles & permissions',
      'Full audit log access',
      'Dedicated account manager',
      'Custom SLA agreement',
    ],
    cta: 'Talk to sales',
    ctaHref: '/contact',
  },
]

const faqs = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes, you can upgrade or downgrade at any time: talk to your account contact and we’ll adjust your next invoice.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Starter and Professional both include a 14-day free trial, no card required.',
  },
  {
    q: 'How does billing work?',
    a: (
      <>
        Subscriptions are invoiced directly by our team, not processed in-app. See our{' '}
        <Link to="/refund-policy">Refund Policy</Link> for details.
      </>
    ),
  },
]

function Pricing() {
  return (
    <section id="pricing" className="pricing-page">
      <div className="pricing-hero">
        <h1>Simple, transparent pricing</h1>
        <h2>Pick a plan that fits your firm today, and scales as you grow.</h2>
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.name} className={`pricing-card${plan.highlighted ? ' highlighted' : ''}`}>
            {plan.highlighted && <span className="pricing-badge">Most popular</span>}
            <span className="pricing-plan-name">{plan.name}</span>
            <div className="pricing-amount">
              <span className="pricing-price">{plan.price !== null ? currencyFormat.format(plan.price) : 'Custom'}</span>
              <span className="pricing-period">{plan.period}</span>
            </div>
            <p className="pricing-desc">{plan.description}</p>
            <ul className="pricing-features">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {plan.ctaHref.startsWith('#') ? (
              <a href={plan.ctaHref} className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-secondary'} pricing-cta`}>
                {plan.cta}
              </a>
            ) : (
              <Link to={plan.ctaHref} className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-secondary'} pricing-cta`}>
                {plan.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="pricing-faq">
        <h3>Frequently asked questions</h3>
        <div className="pricing-faq-list">
          {faqs.map((f) => (
            <div key={f.q} className="pricing-faq-item">
              <span className="pricing-faq-q">{f.q}</span>
              <span className="pricing-faq-a">{f.a}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Pricing
