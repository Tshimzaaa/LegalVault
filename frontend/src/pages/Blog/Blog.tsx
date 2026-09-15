import './Blog.css'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  tag: string
  readTime: string
}

const posts: Post[] = [
  {
    slug: 'hours-lost-to-manual-contract-admin',
    title: '5 ways businesses lose hours to manual contract admin',
    excerpt:
      'Drafting from scratch, document chasing, and status updates quietly eat into your week. Here is where the time actually goes, and how to claw it back.',
    date: '02 Jul 2026',
    tag: 'Operations',
    readTime: '6 min read',
  },
  {
    slug: 'choosing-the-right-nda-template',
    title: 'Choosing the right NDA template for the deal in front of you',
    excerpt:
      'Mutual, one-way, or something in between? A practical guide to picking a starting template instead of drafting from a blank page.',
    date: '24 Jun 2026',
    tag: 'Templates',
    readTime: '8 min read',
  },
  {
    slug: 'negotiating-with-confidence',
    title: 'Negotiating with confidence: fallback positions that actually work',
    excerpt:
      'Pre-approved fallback clauses keep a negotiation moving without waiting on legal for every redline. Here is how to set risk limits your team can act on.',
    date: '15 Jun 2026',
    tag: 'Negotiation',
    readTime: '5 min read',
  },
  {
    slug: 'contract-workflow-that-scales',
    title: 'Building a contract workflow that scales',
    excerpt:
      'From first draft to signed agreement, a repeatable workflow is the difference between a chaotic queue and a calm one.',
    date: '03 Jun 2026',
    tag: 'Workflow',
    readTime: '7 min read',
  },
  {
    slug: 'e-signatures-and-enforceability',
    title: 'E-signatures and enforceability: what to check',
    excerpt:
      'Not all e-signature flows hold up the same way in court. A short checklist for evaluating whether your process is defensible.',
    date: '22 May 2026',
    tag: 'Compliance',
    readTime: '4 min read',
  },
  {
    slug: 'reporting-metrics-that-change-decisions',
    title: 'Reporting metrics that actually change contracting decisions',
    excerpt:
      'Dashboards are easy to build and easy to ignore. These are the handful of numbers well-run teams check weekly.',
    date: '09 May 2026',
    tag: 'Reporting',
    readTime: '6 min read',
  },
]

function Blog() {
  return (
    <section id="blog" className="blog-page">
      <div className="blog-hero">
        <h2 className="blog-hero-title">Insights &amp; Updates</h2>
        <p className="blog-hero-sub">Practical notes on running a modern legal practice, from the team building the tools for it.</p>
      </div>

      <div className="blog-grid">
        {posts.map((post) => (
          <article key={post.slug} className="blog-card">
            <div className="blog-card-thumb" aria-hidden="true" />
            <div className="blog-card-body">
              <span className="blog-tag">{post.tag}</span>
              <h3 className="blog-card-title">{post.title}</h3>
              <p className="blog-card-excerpt">{post.excerpt}</p>
              <div className="blog-card-meta">
                <span>{post.date}</span>
                <span className="blog-meta-dot" />
                <span>{post.readTime}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Blog
