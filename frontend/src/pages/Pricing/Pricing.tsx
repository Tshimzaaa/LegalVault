import './Pricing.css'

interface Plan {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'R1,499',
    period: '/ month',
    description: 'For solo practitioners getting organized.',
    features: [
      'Up to 25 active matters',
      'Client portal access',
      'Document storage (10GB)',
      'Basic billing & invoicing',
      'Email support',
    ],
    cta: 'Start free trial',
  },
  {
    name: 'Professional',
    price: 'R3,299',
    period: '/ month',
    description: 'For growing firms that need more workflow.',
    features: [
      'Unlimited active matters',
      'Client portal + e-signatures',
      'Document storage (100GB)',
      'Advanced billing & trust accounting',
      'Workflow automation',
      'Priority support',
    ],
    highlighted: true,
    cta: 'Start free trial',
  },
  {
    name: 'Firm',
    price: 'Custom',
    period: 'pricing',
    description: 'For multi-partner firms with compliance needs.',
    features: [
      'Everything in Professional',
      'Unlimited storage',
      'Custom roles & permissions',
      'Audit logs & compliance exports',
      'Dedicated account manager',
      'SSO & SLA',
    ],
    cta: 'Talk to sales',
  },
]

const faqs = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes, you can upgrade or downgrade at any time. Changes apply from your next billing cycle.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Starter and Professional both include a 14-day free trial, no card required.',
  },
  {
    q: 'Do you offer discounts for annual billing?',
    a: 'Yes, paying annually saves two months compared to monthly billing on any plan.',
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
              <span className="pricing-price">{plan.price}</span>
              <span className="pricing-period">{plan.period}</span>
            </div>
            <p className="pricing-desc">{plan.description}</p>
            <ul className="pricing-features">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a href="#get-started" className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-secondary'} pricing-cta`}>
              {plan.cta}
            </a>
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
