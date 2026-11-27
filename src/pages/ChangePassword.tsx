import { type FormEvent, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { normalizePassword, validatePassword } from '../lib/password'
import { PasswordField } from '../components/PasswordField'

const AJUDA_SENHA =
  'Informe a senha atual, a nova senha e a confirmação. Mínimo 8 caracteres, com 1 letra e 1 número.'

type ChangePasswordPageProps = {
  embedded?: boolean
}

export function ChangePasswordPage({ embedded = false }: ChangePasswordPageProps) {
  const { changePassword, logout } = useAuth()
  const { push } = useToast()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    const cur = normalizePassword(currentPassword)
    const neu = normalizePassword(newPassword)
    const conf = normalizePassword(confirm)
    if (neu !== conf) {
      setError('A nova senha e a confirmação não coincidem.')
      return
    }
    const pwdErr = validatePassword(neu)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    setBusy(true)
    const err = await changePassword(cur, neu)
    setBusy(false)
    if (err) {
      setError(err)
      push('error', err)
    } else {
      setOk(true)
      // A08: o servidor encerrou todas as sessões, inclusive esta — entrar de novo com a senha nova
      push('ok', 'Senha alterada. Entre de novo com a senha nova.')
      setCurrent('')
      setNew('')
      setConfirm('')
      await logout()
    }
  }

  const form = (
    <form className="form-grid" onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {ok ? <p className="form-ok">Senha alterada com sucesso.</p> : null}
      <label>
        Senha atual
        <PasswordField value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </label>
      <label>
        Nova senha
        <PasswordField value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      <label>
        Confirmar nova senha
        <PasswordField value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar nova senha'}
      </button>
    </form>
  )

  if (embedded) {
    return (
      <div className="card card-papel" id="alterar-senha">
        <h2 className="section-title">Alterar senha</h2>
        <p className="pwd-help">{AJUDA_SENHA}</p>
        {form}
      </div>
    )
  }

  return (
    <div>
      <div className="page-banner">
        <h1 className="page-title">Alterar Senha</h1>
        <p className="page-sub">{AJUDA_SENHA}</p>
      </div>
      <div className="card card-papel">{form}</div>
    </div>
  )
}
