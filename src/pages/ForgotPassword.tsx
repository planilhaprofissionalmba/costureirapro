import { type FormEvent, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLockup } from '../components/BrandLockup'
import { FactoryPitch } from '../components/FactoryPitch'
import { Footer } from '../components/Footer'
import { PasswordField } from '../components/PasswordField'
import { AuthEmailField } from '../components/AuthEmailField'
import { BRAND, linkCompra } from '../lib/brand'
import { normalizePassword, validatePassword } from '../lib/password'
import { callAuth } from '../lib/api'
import { saveRecentEmail } from '../lib/recentEmails'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const emailRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const compra = linkCompra()
  const semLicenca = Boolean(error?.includes('licença') || error?.includes('vencida'))

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const cleanEmail = String(fd.get('email') || '')
      .trim()
      .toLowerCase()
    const pwd = normalizePassword(String(fd.get('password') || ''))
    const pwd2 = normalizePassword(String(fd.get('password_confirm') || ''))
    if (pwd !== pwd2) {
      setError('As senhas não coincidem.')
      return
    }
    const pwdErr = validatePassword(pwd)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    if (totpCode.length !== 6) {
      setError('Informe o código de 6 dígitos do autenticador.')
      return
    }
    setBusy(true)
    const data = await callAuth('forgot', {
      email: cleanEmail,
      password: pwd,
      totpCode,
    })
    setBusy(false)
    if (data.error) {
      setError(String(data.error))
      return
    }
    saveRecentEmail(cleanEmail)
    navigate('/login', { state: { resetOk: true } })
  }

  return (
    <div className="auth-page">
      <div className="auth-page-main">
        <form
          className="auth-card auth-card--forgot"
          method="post"
          action="/esqueci-senha"
          onSubmit={onSubmit}
          autoComplete="on"
        >
          <div className="auth-card-top">
            <BrandLockup tone="light" />
            <FactoryPitch />
            <h1>Esqueci senha</h1>
            <p className="page-sub">E-mail + código do autenticador + nova senha. Não enviamos e-mail.</p>
          </div>
          <div className="auth-card-mid">
            {error && <div className="alert alert-error">{error}</div>}
            <AuthEmailField inputRef={emailRef} id="forgot-email" />
            <div className="auth-field">
              <label className="field-label" htmlFor="forgot-totp">
                Código do autenticador
              </label>
              <input
                id="forgot-totp"
                name="totpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="auth-field">
              <label className="field-label" htmlFor="forgot-password">
                Nova senha
              </label>
              <PasswordField
                id="forgot-password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label className="field-label" htmlFor="forgot-password-confirm">
                Confirmar senha
              </label>
              <PasswordField
                id="forgot-password-confirm"
                name="password_confirm"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Aguarde…' : 'Salvar nova senha'}
            </button>
            <div className="auth-links">
              <Link to="/login">Voltar para entrar</Link>
              <Link to="/login?primeiro=1">Primeiro acesso</Link>
            </div>
            {semLicenca && compra !== '#' ? (
              <a className="btn btn-secondary" href={compra} target="_blank" rel="noreferrer">
                Adquirir licença
              </a>
            ) : semLicenca ? (
              <a className="btn btn-secondary" href={`mailto:${BRAND.supportEmail}`}>
                Falar com suporte
              </a>
            ) : null}
          </div>
        </form>
      </div>
      <Footer compact interesse />
    </div>
  )
}
