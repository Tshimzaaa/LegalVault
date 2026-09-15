import './About.css'

const values = [
  {
    title: 'Built for How Businesses Actually Contract',
    body: 'Every workflow is modeled on real negotiation queues, real deadlines, and real counterparty communication, not a generic project board with a legal skin on it.',
  },
  {
    title: 'Security and Confidentiality First',
    body: 'Your contracts are compartmentalized per organization by design. Access controls and audit trails are treated as core features, not add-ons.',
  },
  {
    title: 'Shipped with the People Who Use It',
    body: 'We build alongside a small group of partner organizations, so features exist because a real business needed them, not because they looked good on a roadmap.',
  },
]

function About() {
  return (
    <section id="about" className="about-page">
      <div className="about-hero">
        <h2 className="about-hero-title">About Us</h2>
        <p className="about-hero-sub">
          We&rsquo;re building the contract platform we wished existed when we worked alongside teams drowning in
          spreadsheets, email threads, and missed deadlines just to get an agreement signed.
        </p>
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
