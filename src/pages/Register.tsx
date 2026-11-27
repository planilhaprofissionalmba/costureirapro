import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { BrandLockup } from '../components/BrandLockup'
import { PasswordField } from '../components/PasswordField'
import { FactoryPitch } from '../components/FactoryPitch'
import { Footer } from '../components/Footer'
import { AuthEmailField } from '../components/AuthEmailField'
import { normalizePassword, validatePassword } from '../lib/password'
import { BRAND } from '../lib/brand'
import { saveRecentEmail } from '../lib/recentEmails'
import { callAuth } from '../lib/api'

type TotpSetup = {
  email: string
  password: string
  qrDataUrl: string
  manualKey: string
}

type Step = 'email' | 'waiting' | 'verifying' | 'password' | 'totp'

export function RegisterPage() {
  const { user, appHomePath, acceptTerms, completeSession } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const registrationTokenParam = (params.get('registration-token') || '').trim()
  const emailRef = useRef<HTMLInputElement>(null)
  const [termsOk, setTermsOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<Step>(() =>
    /^[0-9a-f]{64}$/i.test(registrationTokenParam) ? 'verifying' : 'email',
  )
  const [pendingEmail, setPendingEmail] = useState('')
  const [registrationToken, setRegistrationToken] = useState('')
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null)
  const [totpCode, setTotpCode] = useState('')

  useEffect(() => {
    if (!/^[0-9a-f]{64}$/i.test(registrationTokenParam)) return
    let live = true
    setStep('verifying')
    setBusy(true)
    setError(null)
    async function verify() {
      const data = await callAuth('verify_registration', { registrationToken: registrationTokenParam })
      if (!live) return
      setBusy(false)
      if (data.error) {
        setError(String(data.error))
        setRegistrationToken('')
        setStep('email')
        navigate('/login?primeiro=1', { replace: true })
        return
      }
      setRegistrationToken(registrationTokenParam)
      setPendingEmail(String(data.email || ''))
      setStep('password')
    }
    void verify()
    return () => {
      live = false
    }
  }, [registrationTokenParam, navigate])

  // Já logado (reentrada em /cadastro): 1º painel ou Dashboard conforme Prompt.
  if (user?.termsAcceptedAt) return <Navigate to={appHomePath} replace />

  async function onSubmitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (step === 'verifying' || busy) return
    if (!termsOk) {
      setError('Marque o aceite dos Termos / LGPD para continuar.')
      return
    }
    const fd = new FormData(e.currentTarget)
    const cleanEmail = String(fd.get('email') || '')
      .trim()
      .toLowerCase()
    if (!cleanEmail.includes('@')) {
      setError('Informe um e-mail válido.')
      return
    }
    setBusy(true)
    setError(null)
    const data = await callAuth('register', { email: cleanEmail, termsAccepted: true })
    setBusy(false)
    if (data.error) {
      setError(String(data.error))
      return
    }
    if (data.emailVerificationRequired) {
      saveRecentEmail(cleanEmail)
      setPendingEmail(cleanEmail)
      setStep('waiting')
      return
    }
    setError('Não foi possível enviar a confirmação. Tente de novo.')
  }

  async function onSubmitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!registrationToken) {
      setError('Confirme o e-mail pelo link enviado antes de criar a senha.')
      return
    }
    const fd = new FormData(e.currentTarget)
    const pwd = normalizePassword(String(fd.get('password') || ''))
    const pwdErr = validatePassword(pwd)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    setBusy(true)
    setError(null)
    const data = await callAuth('finish_registration', {
      registrationToken,
      password: pwd,
    })
    setBusy(false)
    if (data.error) {
      setError(String(data.error))
      return
    }
    if (data.needsTotp && data.qrDataUrl) {
      setTotpSetup({
        email: pendingEmail,
        password: pwd,
        qrDataUrl: String(data.qrDataUrl),
        manualKey: String(data.manualKey || ''),
      })
      setStep('totp')
      return
    }
    setError('Não foi possível iniciar o autenticador. Tente de novo.')
  }

  async function onConfirmTotp(e: FormEvent) {
    e.preventDefault()
    if (!totpSetup) return
    setBusy(true)
    setError(null)
    const data = await callAuth('totp_enable', {
      email: totpSetup.email,
      password: totpSetup.password,
      totpCode,
    })
    if (data.error || !data.token) {
      setBusy(false)
      setError(String(data.error || 'Código inválido.'))
      return
    }
    const sessionErr = await completeSession(String(data.token))
    if (sessionErr) {
      setBusy(false)
      setError(sessionErr)
      return
    }
    const termsErr = await acceptTerms()
    setBusy(false)
    if (termsErr) setError(termsErr)
    else navigate('/app/comece-aqui')
  }

  return (
    <div className="auth-page">
      <div className="auth-page-main">
        {step === 'verifying' ? (
          <div className="auth-card">
            <div className="auth-card-top">
              <BrandLockup tone="light" />
              <FactoryPitch />
              <h1>Primeiro acesso</h1>
              <p className="page-sub">Validando o link de confirmação…</p>
            </div>
            <div className="auth-card-mid">
              {error ? <div className="alert alert-error">{error}</div> : null}
              <p className="page-sub">Aguarde um instante. Em seguida você cria a senha.</p>
            </div>
          </div>
        ) : null}

        {step === 'email' || step === 'waiting' ? (
          <form className="auth-card" onSubmit={onSubmitEmail} autoComplete="on">
            <div className="auth-card-top">
              <BrandLockup tone="light" />
              <FactoryPitch />
              <h1>Primeiro acesso</h1>
              <p className="page-sub">
                {step === 'waiting'
                  ? `Enviamos um link para ${pendingEmail}. Abra o e-mail e confirme para criar a senha.`
                  : 'Informe o e-mail da liberação. Enviamos um link de confirmação antes da senha.'}
              </p>
            </div>
            <div className="auth-card-mid">
              {error && <div className="alert alert-error">{error}</div>}
              {step === 'waiting' ? (
                <div className="alert alert-ok" role="status">
                  Confirme o e-mail pelo link. Depois o próprio link abre a criação de senha.
                </div>
              ) : (
                <>
                  <AuthEmailField inputRef={emailRef} id="register-email" />
                  <label className="checkbox auth-terms">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      checked={termsOk}
                      onChange={(e) => {
                        setTermsOk(e.target.checked)
                        if (e.target.checked) setError(null)
                      }}
                    />
                    <span>
                      Li e aceito os{' '}
                      <Link to="/termos" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Termos de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link to="/lgpd" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Privacidade / LGPD
                      </Link>{' '}
                      do CostureiraPro.
                    </span>
                  </label>
                </>
              )}
              {step === 'email' ? (
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Enviando…' : 'Enviar confirmação'}
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    setStep('email')
                  }}
                >
                  Reenviar para outro e-mail
                </button>
              )}
              <div className="auth-links">
                <Link to="/login">Já tenho senha</Link>
                <a href={`mailto:${BRAND.supportEmail}`}>Suporte</a>
              </div>
            </div>
          </form>
        ) : null}

        {step === 'password' ? (
          <form className="auth-card" onSubmit={onSubmitPassword} autoComplete="on">
            <div className="auth-card-top">
              <BrandLockup tone="light" />
              <FactoryPitch />
              <h1>Criar senha</h1>
              <p className="page-sub">E-mail confirmado: {pendingEmail}. Defina a senha do CostureiraPro.</p>
            </div>
            <div className="auth-card-mid">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="auth-field">
                <label className="field-label" htmlFor="register-password">
                  Senha
                </label>
                <PasswordField
                  id="register-password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Criando…' : 'Continuar'}
              </button>
              <div className="auth-links">
                <Link to="/login">Já tenho senha</Link>
              </div>
            </div>
          </form>
        ) : null}

        {step === 'totp' && totpSetup ? (
          <form className="auth-card auth-card--forgot" onSubmit={onConfirmTotp}>
            <div className="auth-card-top">
              <BrandLockup tone="light" />
              <FactoryPitch />
              <h1>Autenticador</h1>
              <p className="page-sub">Escaneie o QR no Google ou Microsoft Authenticator e digite o código de 6 dígitos.</p>
            </div>
            <div className="auth-card-mid">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="totp-qr-wrap">
                <img src={totpSetup.qrDataUrl} alt="QR Code do autenticador CostureiraPro" width={180} height={180} />
              </div>
              {totpSetup.manualKey ? (
                <p className="page-sub totp-manual">
                  Ou digite a chave: <strong>{totpSetup.manualKey}</strong>
                </p>
              ) : null}
              <div className="auth-field">
                <label className="field-label" htmlFor="register-totp">
                  Código do autenticador
                </label>
                <input
                  id="register-totp"
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
              <button className="btn btn-primary" type="submit" disabled={busy || totpCode.length !== 6}>
                {busy ? 'Validando…' : 'Confirmar e entrar'}
              </button>
              <div className="auth-links">
                <Link to="/login">Voltar para entrar</Link>
              </div>
            </div>
          </form>
        ) : null}
      </div>
      <Footer compact interesse />
    </div>
  )
}
