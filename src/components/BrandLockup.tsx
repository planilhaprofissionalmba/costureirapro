import { APP_NAME, APP_SLOGAN } from '../lib/brand'

type BrandLockupProps = {
  tone?: 'dark' | 'light'
  subtitle?: string
  className?: string
}

export function BrandLockup({
  tone = 'light',
  subtitle = APP_SLOGAN,
  className = '',
}: BrandLockupProps) {
  return (
    <div className={`brand-lockup brand-lockup--${tone} ${className}`.trim()}>
      <div className="brand-lockup-row">
        <div className="brand-lockup-icon-wrap brand-lockup-icon-wrap--app">
          <img src="/app-icon.png" alt="CostureiraPro" className="brand-lockup-icon" onError={(e) => { (e.target as HTMLImageElement).src = '/app-icon.svg' }} />
        </div>
        <div className="brand-lockup-text">
          <strong className="brand-lockup-name">{APP_NAME}</strong>
          {subtitle ? <span className="brand-lockup-desc">{subtitle}</span> : null}
        </div>
      </div>
    </div>
  )
}
