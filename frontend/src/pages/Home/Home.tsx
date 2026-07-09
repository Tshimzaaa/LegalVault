import { useEffect, useState } from 'react'
import './Home.css'
import dashboardShot from '../../assets/screenshots/dashboard.png'
import newMatterShot from '../../assets/screenshots/new-matter.png'

const slides = [
  { src: dashboardShot, alt: 'Dashboard overview' },
  { src: newMatterShot, alt: 'Open New Matter form' },
]

function Home() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="home">
      <section className="hero">

        <h1>The Modern Practice Management</h1>
        <h2>Manage matters, clients, and billing in one secure, compliant workspace.</h2>

        <div className="hero-actions">
          <a href="#get-template" className="btn btn-primary">
            consultation

          </a>
          <a href="#learn-more" className="btn btn-secondary">
            Learn More
          </a>
        </div>

        <div className="hero-mockup">
          <div className="mockup-window">
            <div className="mockup-topbar">
              <span className="mockup-brand">Index</span>
              <span className="mockup-search" />
              <span className="mockup-dots">
                <span />
                <span />
              </span>
            </div>
            <div className="mockup-slides">
              {slides.map((slide, i) => (
                <img
                  key={slide.src}
                  src={slide.src}
                  alt={slide.alt}
                  className={`mockup-slide${i === active ? ' active' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="slide-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                className={`slide-dot${i === active ? ' active' : ''}`}
                onClick={() => setActive(i)}
                aria-label={`Show ${slide.alt}`}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default Home
