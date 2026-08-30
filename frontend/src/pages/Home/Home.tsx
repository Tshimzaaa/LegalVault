import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import './Home.css'
import Sidebar from '../../components/Sidebar'
import Footer from '../../components/Footer'
import { staffNavItems } from '../Workspace/staffNav'
import type { StaffPage } from '../Workspace/staffNav'
import type { User } from '../../api/auth'
import Dashboard from '../Dashboard/Dashboard'
import type { DashboardSummary } from '../../api/dashboard'
import NewMatter from '../NewMatter/NewMatter'
import Workflow from '../Workflow/Workflow'
import SignedContracts from '../SignedContracts/SignedContracts'
import Reporting from '../Reporting/Reporting'
import ContractData from '../ContractData/ContractData'
import Templates from '../Templates/Templates'
import About from '../About/About'
import Blog from '../Blog/Blog'
import Contact from '../Contact/Contact'

const demoUser: User = {
  id: 'demo',
  firm_id: 'demo',
  first_name: 'Demo',
  last_name: 'User',
  email: 'demo@example.com',
  role: 'admin',
  is_active: true,
  invitation_status: 'accepted',
  last_login: null,
}

function noop() {}

const demoSummary: DashboardSummary = {
  activeCases: { count: 34, totalValue: 'R4.2M', progressPercent: 68 },
  contractStatus: {
    total: 52,
    breakdown: [
      { label: 'Signed', count: 31, color: '#22c55e' },
      { label: 'Pending', count: 14, color: '#eab308' },
      { label: 'Expired', count: 7, color: '#ef4444' },
    ],
  },
  keyDeadlines: [
    { title: 'Pleadings cut-off — Case 2024-101', deadline: '15 Mar', flagColor: '#ef4444' },
    { title: 'Discovery close — Case 2024-105', deadline: '18 Mar', flagColor: '#f97316' },
    { title: 'Contract renewal — MSA-2022-051', deadline: '10 Apr', flagColor: '#9ca3af' },
  ],
  tasks: [
    { title: 'Review NDA — Apex Corp', deadline: '15 Mar' },
    { title: 'File motion — Estate of J. Botha', deadline: '18 Mar' },
  ],
  recentDocuments: [
    { title: 'Share Purchase Agreement.pdf', subtitle: 'Meridian Capital' },
    { title: 'Master Services Agreement.pdf', subtitle: 'Vantage Logistics' },
  ],
  recentCommunications: [
    { text: 'Client portal message from Coastal Retail re: lease renewal' },
    { text: 'E-sign completed on Trademark Licensing — Kaya Software' },
  ],
}

interface CaptureTarget {
  key: string
  alt: string
  page: StaffPage
  node: React.ReactNode
}

const captureTargets: CaptureTarget[] = [
  {
    key: 'dashboard',
    alt: 'Dashboard overview',
    page: 'dashboard',
    node: <Dashboard user={demoUser} onLogout={noop} previewSummary={demoSummary} />,
  },
  { key: 'new-matter', alt: 'Open New Matter form', page: 'new-matter', node: <NewMatter /> },
  { key: 'workflow', alt: 'Workflow board', page: 'workflow', node: <Workflow /> },
  { key: 'signed-contracts', alt: 'Signed Contracts', page: 'signed-contracts', node: <SignedContracts /> },
  { key: 'reporting', alt: 'Reporting', page: 'reporting', node: <Reporting /> },
  { key: 'contract-data', alt: 'Contract Data', page: 'contract-data', node: <ContractData /> },
  { key: 'templates', alt: 'Templates', page: 'templates', node: <Templates /> },
]

function useCapturedSlides() {
  const [captured, setCaptured] = useState<Record<string, string>>({})
  const captureRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      // Let the off-screen pages paint before snapshotting them.
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const root = captureRootRef.current
      if (!root) return

      for (const target of captureTargets) {
        if (cancelled) return
        const el = root.querySelector<HTMLElement>(`[data-capture-key="${target.key}"]`)
        if (!el) continue

        try {
          const canvas = await html2canvas(el, {
            width: 1440,
            height: 900,
            backgroundColor: '#050506',
            scale: 1,
          })
          if (cancelled) return
          setCaptured((prev) => ({ ...prev, [target.key]: canvas.toDataURL('image/png') }))
        } catch {
          // Leave this slide unset; carousel just skips it while empty.
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  return { captured, captureRootRef }
}

function Home() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const { captured, captureRootRef } = useCapturedSlides()

  const slides = captureTargets.map((target) => ({
    alt: target.alt,
    src: captured[target.key] ?? null,
  }))

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || paused) return

    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length)
    }, 4000)
    return () => clearInterval(id)
  }, [slides.length, paused])

  return (
    <main className="home" id="main-content">
      <section id="home" className="hero">

        <h1>The Modern Practice Management</h1>
        <h2>Manage matters, clients, and billing in one secure, compliant workspace.</h2>

        <div className="hero-actions">
          <a href="#contact" className="btn btn-primary">
            Book a Consultation
          </a>
          <a href="#about" className="btn btn-secondary">
            See How It Works
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
              {slides.map((slide, i) =>
                slide.src ? (
                  <img
                    key={slide.alt}
                    src={slide.src}
                    alt={slide.alt}
                    width={1440}
                    height={900}
                    className={`mockup-slide${i === active ? ' active' : ''}`}
                  />
                ) : null
              )}
            </div>
          </div>

          <div className="slide-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.alt}
                type="button"
                className={`slide-dot${i === active ? ' active' : ''}`}
                onClick={() => setActive(i)}
                aria-label={`Show ${slide.alt}`}
              />
            ))}
            <button
              type="button"
              className="slide-pause-btn"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play slide rotation' : 'Pause slide rotation'}
              aria-pressed={paused}
            >
              {paused ? '▶' : '⏸'}
            </button>
          </div>
        </div>
      </section>

      <About />
      <Blog />
      <Contact />
      <Footer />

      {/* Off-screen render of every page, captured once into the static images above. */}
      <div className="capture-root" ref={captureRootRef} aria-hidden="true">
        {captureTargets.map((target) => (
          <div key={target.key} data-capture-key={target.key} className="capture-frame">
            <div className="dash-layout">
              <Sidebar
                activePage={target.page}
                onNavigate={noop}
                navItems={staffNavItems}
                user={demoUser}
                onLogout={noop}
              />
              {target.node}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

export default Home
