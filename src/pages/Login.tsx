import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { RegisterPage } from './Register'
import { isOnboardingDone, useAuth } from '../lib/auth'
import { BrandLockup } from '../components/BrandLockup'
import { PasswordField } from '../components/PasswordField'
import { FactoryPitch } from '../components/FactoryPitch'
import { Footer } from '../components/Footer'
import { AuthEmailField } from '../components/AuthEmailField'
import { BRAND, linkCompra, linkWhatsAppInteresse } from '../lib/brand'
import { saveRecentEmail } from '../lib/recentEmails'
import { callAuth } from '../lib/api'
import { normalizePassword } from '../lib/password'

/** Lê e-mail/senha direto do DOM — o Chrome preenche sem passar pelo state React. */
function readAuthForm(form: HTMLFormElement) {
  const fd = new FormData(form)
  const email = String(fd.get('email') || '')
    .trim()
    .toLowerCase()
  let password = String(fd.get('password') || '')
  // Fallback: autofill às vezes não entra no FormData na 1ª leitura.
  if (!password) {
    const el = form.querySelector<HTMLInputElement>('input[name="password"]')
    password = el?.value || ''
  }
  return { email, password: normalizePassword(password) }
}

type TotpSetup = {
  email: string
  password: string
  qrDataUrl: string
  manualKey: string
}

/** A02: Primeiro acesso dentro de /login (?primeiro=1 ou ?registration-token= do e-mail), no mesmo card. */
export function LoginPage() {
  const [params] = useSearchParams()
  if (params.get('primeiro') === '1' || params.get('registration-token')) return <RegisterPage />
  return <LoginForm />
}

function LoginForm() {
  const { user, loading, appHomePath, sessionExpired, clearSessionExpired, acceptTerms, logout, completeSession } =
    useAuth()

  function homeAfterAuth(accountId?: string | null) {
    return isOnboardingDone(accountId) ? '/app/dashboard' : '/app/comece-aqui'
  }
  const navigate = useNavigate()
  const location = useLocation()
  const emailRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [needTerms, setNeedTerms] = useState(Boolean((location.state as { needTerms?: boolean } | null)?.needTerms))
  const [termsOk, setTermsOk] = useState(false)
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const expired = sessionExpired || Boolean((location.state as { expired?: boolean } | null)?.expired)
  const resetOk = Boolean((location.state as { resetOk?: boolean } | null)?.resetOk)
  const compra = linkCompra()
  const semLicenca = Boolean(error?.includes('licença') || error?.includes('vencida'))

  useEffect(() => {
    if (user && !user.termsAcceptedAt) setNeedTerms(true)
  }, [user])

  // Entrar pela Landing sempre pede a senha: encerra a sessão aberta (também no servidor) antes de mostrar o login.
  const pedirSenha = Boolean((location.state as { pedirSenha?: boolean } | null)?.pedirSenha)
  const [encerrando, setEncerrando] = useState(pedirSenha)
  const encerrou = useRef(false)

  useEffect(() => {
    if (!pedirSenha || loading || encerrou.current) return
    encerrou.current = true
    const fim = () => {
      setEncerrando(false)
      navigate('/login', { replace: true, state: null })
    }
    if (user) logout().catch(() => undefined).finally(fim)
    else fim()
  }, [pedirSenha, loading, user, logout, navigate])

  // Enquanto cadastra TOTP, não redireciona (sessão antiga no localStorage atrapalhava o QR).
  // Espera loading para não usar flag de 1º acesso ainda não sincronizada.
  if (!loading && !encerrando && user && user.termsAcceptedAt && !needTerms && !totpSetup) {
    return <Navigate to={appHomePath} replace />
  }

  const showTermsGate = Boolean(!totpSetup && (needTerms || (user && !user.termsAcceptedAt)))

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    clearSessionExpired()
    const { email, password } = readAuthForm(e.currentTarget)
    if (email) saveRecentEmail(email)
    const data = await callAuth('login', { email, password })
    setBusy(false)
    if (data.needsTotp) {
      if (!data.qrDataUrl) {
        setError('Não foi possível montar o QR do autenticador. Atualize a página (Ctrl+F5) e tente de novo.')
        return
      }
      // Limpa sessão antiga para o QR não ficar atrás do aceite de termos.
      await logout()
      setNeedTerms(false)
      setTotpSetup({
        email,
        password,
        qrDataUrl: String(data.qrDataUrl),
        manualKey: String(data.manualKey || ''),
      })
      return
    }
    if (data.error || !data.token) {
      setError(String(data.error || 'Não foi possível entrar.'))
      return
    }
    const sessionErr = await completeSession(String(data.token))
    if (sessionErr) {
      setError(sessionErr)
      return
    }
    const me = await callAuth('me', { token: String(data.token) })
    const meUser = me.user as { terms_accepted_at?: string; account_id?: string; accountId?: string } | undefined
    const termsAt = meUser?.terms_accepted_at
    if (!termsAt) {
      setNeedTerms(true)
      return
    }
    navigate(homeAfterAuth(meUser?.account_id || meUser?.accountId || user?.accountId))
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
    setBusy(false)
    if (data.error || !data.token) {
      setError(String(data.error || 'Código inválido.'))
      return
    }
    const sessionErr = await completeSession(String(data.token))
    if (sessionErr) {
      setError(sessionErr)
      return
    }
    setTotpSetup(null)
    setNeedTerms(true)
  }

  async function onAcceptTerms(e: FormEvent) {
    e.preventDefault()
    if (!termsOk) {
      setError('Marque o aceite dos Termos / LGPD para continuar.')
      return
    }
    setBusy(true)
    setError(null)
    const err = await acceptTerms()
    setBusy(false)
    if (err) setError(err)
    else {
      setNeedTerms(false)
      navigate(homeAfterAuth(user?.accountId))
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-main">
        {totpSetup ? (
          <form className="auth-card auth-card--forgot" onSubmit={onConfirmTotp}>
            <div className="auth-card-top">
              <BrandLockup tone="light" />
              <FactoryPitch />
              <h1>Cadastrar autenticador</h1>
              <p className="page-sub">
                Escaneie o QR <strong>desta tela</strong> (conta <strong>CostureiraPro</strong>). Se já existir uma
                entrada antiga do CostureiraPro no celular, apague-a antes — senão o código não confere.
              </p>
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
                <label className="field-label" htmlFor="login-totp">
                  Código do autenticador (6 dígitos atuais)
                </label>
                <input
                  id="login-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(ev) => setTotpCode(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || totpCode.length !== 6}>
                {busy ? 'Validando…' : 'Confirmar'}
              </button>
            </div>
          </form>
        ) : (
          <form
            className={showTermsGate ? 'auth-card' : 'auth-card auth-card--entrar'}
            method="post"
            action="/login"
            onSubmit={showTermsGate ? onAcceptTerms : onSubmit}
            autoComplete="on"
          >
            <div className="auth-card-top">
              <BrandLockup tone="light" />
              <FactoryPitch />
              {showTermsGate ? <h1>Aceite dos Termos</h1> : null}
            </div>

            {showTermsGate ? (
              <div className="auth-card-mid">
                {error && <div className="alert alert-error">{error}</div>}
                <p className="page-sub">
                  Antes de abrir o painel, leia e aceite os{' '}
                  <Link to="/termos" target="_blank">
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link to="/lgpd" target="_blank">
                    Privacidade / LGPD
                  </Link>
                  .
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={termsOk}
                    onChange={(e) => setTermsOk(e.target.checked)}
                    required
                  />
                  Li e aceito os Termos de Uso e a Privacidade / LGPD do CostureiraPro.
                </label>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Salvando…' : 'Aceitar e continuar'}
                </button>
                <div className="auth-links">
                  <button
                    className="linkish"
                    type="button"
                    onClick={async () => {
                      setNeedTerms(false)
                      setTermsOk(false)
                      await logout()
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="auth-card-mid">
                  {expired && <div className="alert alert-warn">Sua sessão expirou. Entre de novo.</div>}
                  {resetOk && <div className="alert alert-ok">Senha alterada. Entre com a nova senha.</div>}
                  {error && <div className="alert alert-error">{error}</div>}
                  <AuthEmailField inputRef={emailRef} id="login-email" />
                  <div className="auth-field">
                    <label className="field-label" htmlFor="login-password">
                      Senha
                    </label>
                    <PasswordField
                      id="login-password"
                      name="password"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Entrando…' : 'Entrar'}
                  </button>
                  <div className="auth-links">
                    <Link to="/esqueci-senha">Esqueci senha</Link>
                    <Link to="/login?primeiro=1">Primeiro acesso</Link>
                  </div>
                </div>
                <div className="auth-card-base">
                  <div className="auth-licenca">
                    {semLicenca ? (
                      <>
                        <p>Sem licença no momento.</p>
                        <a className="btn btn-primary" href={compra} target="_blank" rel="noreferrer">
                          Adquirir
                        </a>
                      </>
                    ) : (
                      <p className="auth-licenca-line">
                        <span>Ainda sem licença?</span>
                        <a className="btn btn-primary btn-adquirir" href={compra} target="_blank" rel="noreferrer">
                          Adquirir
                        </a>
                        <span aria-hidden="true">·</span>
                        <a href={linkWhatsAppInteresse()} target="_blank" rel="noreferrer">
                          WhatsApp {BRAND.whatsappDisplay}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </form>
        )}
      </div>
      <Footer compact interesse />
    </div>
  )
}
