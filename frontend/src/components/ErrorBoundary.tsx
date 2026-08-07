import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

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
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: '#000',
            color: '#fff',
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong.</h1>
          <p style={{ color: '#9ca3af', margin: 0, maxWidth: 420 }}>
            This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, let us know
            what you were doing.
          </p>
          <button
            type="button"
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
