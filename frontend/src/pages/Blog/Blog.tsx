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
    slug: 'billable-hours-manual-admin',
    title: '5 ways firms lose billable hours to manual admin',
    excerpt:
      'Contract intake, document chasing, and status updates quietly eat into your week. Here is where the time actually goes, and how to claw it back.',
    date: '02 Jul 2026',
    tag: 'Operations',
    readTime: '6 min read',
  },
  {
    slug: 'trust-accounting-compliance',
    title: 'A practical guide to trust accounting compliance',
    excerpt:
      'Trust accounting mistakes are one of the top reasons for bar complaints. A walkthrough of the controls every firm should have in place.',
    date: '24 Jun 2026',
    tag: 'Compliance',
    readTime: '8 min read',
  },
  {
    slug: 'client-portals-what-clients-want',
    title: 'Client portals: what clients actually want to see',
    excerpt:
      'We looked at portal usage across dozens of firms. The features clients open most are rarely the ones firms invest in first.',
    date: '15 Jun 2026',
    tag: 'Client Experience',
    readTime: '5 min read',
  },
  {
    slug: 'contract-intake-workflow-that-scales',
    title: 'Building a contract intake workflow that scales',
    excerpt:
      'From first inquiry to signed engagement letter, a repeatable intake process is the difference between a chaotic queue and a calm one.',
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
    title: 'Reporting metrics that actually change firm decisions',
    excerpt:
      'Dashboards are easy to build and easy to ignore. These are the handful of numbers partners at well-run firms check weekly.',
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
          <a href={`#${post.slug}`} key={post.slug} className="blog-card">
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
          </a>
        ))}
      </div>
    </section>
  )
}

export default Blog
