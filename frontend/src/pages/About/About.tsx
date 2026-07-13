import './About.css'

const stats = [
  { value: '120+', label: 'Firms onboarded' },
  { value: '18k', label: 'Matters managed' },
  { value: '99.9%', label: 'Platform uptime' },
  { value: '4', label: 'Years building for legal teams' },
]

const values = [
  {
    title: 'Built for how firms actually work',
    body: 'Every workflow is modeled on real intake queues, real deadlines, and real client communication — not a generic project board with a legal skin on it.',
  },
  {
    title: 'Security and confidentiality first',
    body: 'Client data is compartmentalized per firm by design. Access controls and audit trails are treated as core features, not add-ons.',
  },
  {
    title: 'Shipped with the people who use it',
    body: 'We build alongside a small group of partner firms, so features exist because a real practice needed them, not because they looked good on a roadmap.',
  },
]

function About() {
  return (
    <section id="about" className="about-page">
      <div className="about-hero">
        <h1>About us </h1>
        <h2>
          We&rsquo;re building the practice management platform we wished existed when we worked alongside legal
          teams drowning in spreadsheets, email threads, and missed deadlines.
        </h2>
      </div>

      <div className="about-stats">
        {stats.map((s) => (
          <div key={s.label} className="about-stat">
            <span className="about-stat-value">{s.value}</span>
            <span className="about-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="about-values">
        {values.map((v) => (
          <div key={v.title} className="about-value-card">
            <h3>{v.title}</h3>
            <p>{v.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default About
