import './ThemeToggle.css'
import { IconSun, IconMoon } from './icons'
import { useTheme } from '../theme/ThemeContext'

interface ThemeToggleProps {
  className?: string
}

function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === 'light' ? <IconMoon /> : <IconSun />}
    </button>
  )
}

export default ThemeToggle
