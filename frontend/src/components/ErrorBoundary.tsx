import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Without this, any render-time throw anywhere in the tree unmounts the whole app to a blank
 * screen with no on-page indication of what happened — React doesn't recover from that on its
 * own. This catches it and offers a reload instead of leaving the user staring at nothing.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
    // Safe to call even when Sentry.init() never ran — becomes a no-op.
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="error-boundary-screen"
          style={{
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong.</h1>
          <p className="error-boundary-sub" style={{ margin: 0, maxWidth: 420 }}>
            This page hit an unexpected error. Reloading usually fixes it; if it keeps happening, let us know
            what you were doing.
          </p>
          <style>{`
            .error-boundary-screen {
              /* Self-contained fallback colors (no ThemeContext/CSS variables assumed available) —
                 this can render when the rest of the app's context tree has failed. */
              --ebg: #ffffff;
              --etext: #18181b;
              --etext-muted: #6b7280;
              background: var(--ebg);
              color: var(--etext);
            }
            @media (prefers-color-scheme: dark) {
              .error-boundary-screen {
                --ebg: #000000;
                --etext: #f3f4f6;
                --etext-muted: #9ca3af;
              }
            }
            .error-boundary-sub {
              color: var(--etext-muted);
            }
            .error-boundary-reload:hover,
            .error-boundary-reload:focus-visible {
              filter: brightness(1.1);
              outline: 2px solid #4ade80;
              outline-offset: 2px;
            }
          `}</style>
          <button
            type="button"
            className="error-boundary-reload"
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 999,
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #4ade80, #16a34a)',
              color: '#06210f',
            }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
