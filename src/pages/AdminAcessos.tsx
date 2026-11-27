import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isDeveloperAdmin } from '../lib/admin'
import { callAuth } from '../lib/api'
import { SyncedTable } from '../components/SyncedTable'
import { PasswordField } from '../components/PasswordField'
import { validatePassword } from '../lib/password'
import { formatDateBR, textoRestante } from '../lib/format'

type LicenseRow = {
  id: string
  email: string
  status: string
  plan?: string
  notes?: string | null
  hotmartId?: string | null
  createdAt?: string
  expiresAt?: string | null
}

/** D11: tipo de licença escolhido na Administração ('' = manter como está, só na edição). */
type TipoLicenca = '' | 'vitalicia' | 'trial7' | 'data'

function corpoTipo(tipo: TipoLicenca, vencimento: string): Record<string, string> {
  if (!tipo) return {}
  return tipo === 'data' ? { licenseType: tipo, expiresOn: vencimento } : { licenseType: tipo }
}

function descreveLicenca(row: LicenseRow): string {
  if (!row.expiresAt) return 'Vitalícia'
  return `Teste · vence ${formatDateBR(row.expiresAt)} · ${textoRestante(row.expiresAt)}`
}

function CampoTipoLicenca({
  tipo,
  vencimento,
  onTipo,
  onVencimento,
  permitirManter,
}: {
  tipo: TipoLicenca
  vencimento: string
  onTipo: (t: TipoLicenca) => void
  onVencimento: (v: string) => void
  permitirManter?: boolean
}) {
  return (
    <>
      <label className="field-label">
        Tipo de licença
        <select value={tipo} onChange={(e) => onTipo(e.target.value as TipoLicenca)}>
          {permitirManter ? <option value="">Manter como está</option> : null}
          <option value="vitalicia">Vitalícia</option>
          <option value="trial7">Trial 7 dias</option>
          <option value="data">Vencimento em data</option>
        </select>
      </label>
      {tipo === 'data' ? (
        <label className="field-label">
          Vence em
          <input type="date" required value={vencimento} onChange={(e) => onVencimento(e.target.value)} />
        </label>
      ) : null}
    </>
  )
}

export function AdminAcessosPage() {
  const { user } = useAuth()
  const token = user?.accessToken || ''
  const allowed = isDeveloperAdmin(user)
  const [items, setItems] = useState<LicenseRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [libEmail, setLibEmail] = useState('')
  const [libHotmart, setLibHotmart] = useState('')
  const [libNotes, setLibNotes] = useState('')
  const [libTipo, setLibTipo] = useState<TipoLicenca>('vitalicia')
  const [libVence, setLibVence] = useState('')
  const [convTipo, setConvTipo] = useState<TipoLicenca>('vitalicia')
  const [convVence, setConvVence] = useState('')
  const [createTipo, setCreateTipo] = useState<TipoLicenca>('vitalicia')
  const [createVence, setCreateVence] = useState('')
  const [editTipo, setEditTipo] = useState<TipoLicenca>('')
  const [editVence, setEditVence] = useState('')
  const [convEmail, setConvEmail] = useState('')
  const [convNotes, setConvNotes] = useState('')
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [editing, setEditing] = useState<LicenseRow | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editHotmart, setEditHotmart] = useState('')

  const load = useCallback(async () => {
    if (!token || !allowed) return
    const data = await callAuth('admin_list', { token })
    if (data.error) {
      setError(String(data.error))
      return
    }
    setItems((data.items as LicenseRow[]) || [])
    setError(null)
  }, [token, allowed])

  useEffect(() => {
    void load()
  }, [load])

  if (!allowed) {
    return <Navigate to="/app/dashboard" replace />
  }

  async function run(
    key: string,
    action: string,
    body: Record<string, unknown>,
    okFallback: string,
    onOk?: () => void,
  ): Promise<boolean> {
    setBusy(key)
    setError(null)
    setMsg(null)
    const data = await callAuth(action, { token, ...body })
    setBusy(null)
    if (data.error) {
      setError(String(data.error))
      return false
    }
    const detail = String(data.message || okFallback)
    setMsg(`Salvo — ${detail}`)
    onOk?.()
    await load()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  async function onLiberar(e: FormEvent) {
    e.preventDefault()
    await run(
      'liberar',
      'admin_liberar',
      {
        targetEmail: libEmail.trim().toLowerCase(),
        hotmartId: libHotmart.trim() || undefined,
        notes: libNotes.trim() || undefined,
        ...corpoTipo(libTipo, libVence),
      },
      'Licença liberada.',
      () => {
        setLibEmail('')
        setLibHotmart('')
        setLibNotes('')
        setLibTipo('vitalicia')
        setLibVence('')
      },
    )
  }

  async function onConvite(e: FormEvent) {
    e.preventDefault()
    await run(
      'convite',
      'admin_convite',
      {
        targetEmail: convEmail.trim().toLowerCase(),
        notes: convNotes.trim() || undefined,
        ...corpoTipo(convTipo, convVence),
      },
      'Licença liberada.',
      () => {
        setConvEmail('')
        setConvNotes('')
        setConvTipo('vitalicia')
        setConvVence('')
      },
    )
  }

  async function onCriar(e: FormEvent) {
    e.preventDefault()
    const pwdErr = validatePassword(createPassword)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    await run(
      'criar',
      'admin_criar_conta',
      {
        targetEmail: createEmail.trim().toLowerCase(),
        password: createPassword,
        fullName: createName.trim() || undefined,
        ...corpoTipo(createTipo, createVence),
      },
      'Conta criada.',
      () => {
        setCreateName('')
        setCreateEmail('')
        setCreatePassword('')
        setCreateTipo('vitalicia')
        setCreateVence('')
      },
    )
  }

  function startEdit(row: LicenseRow) {
    setEditing(row)
    setEditEmail(row.email)
    setEditNotes(row.notes || '')
    setEditHotmart(row.hotmartId || '')
    setEditTipo('')
    setEditVence('')
    setError(null)
    setMsg(null)
  }

  async function onEditar(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const ok = await run(
      `edit-${editing.id}`,
      'admin_editar',
      {
        licenseId: editing.id,
        targetEmail: editEmail.trim().toLowerCase(),
        notes: editNotes.trim(),
        hotmartId: editHotmart.trim(),
        ...corpoTipo(editTipo, editVence),
      },
      'E-mail autorizado atualizado.',
      () => setEditing(null),
    )
    if (ok) {
      setEditEmail('')
      setEditNotes('')
      setEditHotmart('')
    }
  }

  async function onExcluir(row: LicenseRow) {
    if (!window.confirm(`Excluir ${row.email} da lista de autorizados? A licença será removida.`)) return
    await run(row.id, 'admin_excluir', { licenseId: row.id }, 'E-mail excluído da lista.')
  }

  async function onResetTotp(e: FormEvent) {
    e.preventDefault()
    if (!window.confirm('Resetar o autenticador deste e-mail? O cliente precisará cadastrar um QR novo no próximo login.')) {
      return
    }
    await run(
      'reset-totp',
      'admin_reset_totp',
      { targetEmail: resetEmail.trim().toLowerCase() },
      'Autenticador resetado.',
      () => setResetEmail(''),
    )
  }

  return (
    <div>
      <h1 className="page-title">Administração de acessos</h1>
      <p className="page-sub">
        Acesso restrito a: <strong>{user?.email}</strong>. A coluna Observações é só anotação — não concede
        permissão de administrador.
      </p>
      <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
        <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Não use “Invite user” no painel do Supabase. Libere por esta tela. Toda ação é validada na Edge.
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && (
        <div className="alert alert-ok" role="status">
          {msg}
        </div>
      )}

      <div className="admin-grid">
        <form className="card config-box" onSubmit={onLiberar}>
          <h2 className="section-title">Liberar e-mail</h2>
          <p className="config-meta">Só ativa a licença. O cliente cria a senha em Primeiro acesso.</p>
          <label className="field-label">
            E-mail
            <input
              type="email"
              required
              value={libEmail}
              onChange={(e) => setLibEmail(e.target.value)}
              placeholder="comprador@email.com"
            />
          </label>
          <label className="field-label">
            ID transação Hotmart (opcional)
            <input value={libHotmart} onChange={(e) => setLibHotmart(e.target.value)} placeholder="HP123…" />
          </label>
          <label className="field-label">
            Observações
            <textarea rows={2} value={libNotes} onChange={(e) => setLibNotes(e.target.value)} />
          </label>
          <CampoTipoLicenca tipo={libTipo} vencimento={libVence} onTipo={setLibTipo} onVencimento={setLibVence} />
          <button className="btn btn-primary" type="submit" disabled={busy === 'liberar'}>
            {busy === 'liberar' ? 'Salvando…' : 'Liberar acesso'}
          </button>
        </form>

        <form className="card config-box" onSubmit={onConvite}>
          <h2 className="section-title">Enviar convite por e-mail</h2>
          <p className="config-meta">
            Neste app não enviamos e-mail automático. Use Liberar + oriente o cliente ao Primeiro acesso.
          </p>
          <label className="field-label">
            E-mail
            <input
              type="email"
              required
              value={convEmail}
              onChange={(e) => setConvEmail(e.target.value)}
              placeholder="comprador@email.com"
            />
          </label>
          <label className="field-label">
            Observações (opcional)
            <textarea rows={2} value={convNotes} onChange={(e) => setConvNotes(e.target.value)} />
          </label>
          <CampoTipoLicenca tipo={convTipo} vencimento={convVence} onTipo={setConvTipo} onVencimento={setConvVence} />
          <button className="btn btn-primary" type="submit" disabled={busy === 'convite'}>
            {busy === 'convite' ? 'Salvando…' : 'Enviar convite'}
          </button>
        </form>

        <form className="card config-box" onSubmit={onCriar}>
          <h2 className="section-title">Cadastro manual completo</h2>
          <p className="config-meta">Cria licença + conta com senha. Se o e-mail já existir, só atualiza a licença.</p>
          <label className="field-label">
            Nome
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} />
          </label>
          <label className="field-label">
            E-mail
            <input
              type="email"
              required
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
            />
          </label>
          <label className="field-label">
            Senha inicial
            <PasswordField
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <CampoTipoLicenca
            tipo={createTipo}
            vencimento={createVence}
            onTipo={setCreateTipo}
            onVencimento={setCreateVence}
          />
          <button className="btn btn-primary" type="submit" disabled={busy === 'criar'}>
            {busy === 'criar' ? 'Criando…' : 'Criar conta'}
          </button>
        </form>

        <form className="card config-box" onSubmit={onResetTotp}>
          <h2 className="section-title">Resetar autenticador (TOTP)</h2>
          <p className="config-meta">
            Limpa o autenticador da conta e revoga sessões. No próximo login o cliente cadastra QR novo.
            Oriente a apagar a entrada antiga deste app no celular antes de escanear.
          </p>
          <label className="field-label">
            E-mail da conta
            <input
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy === 'reset-totp'}>
            {busy === 'reset-totp' ? 'Resetando…' : 'Resetar autenticador'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">E-mails autorizados ({items.length})</h2>
        {editing && (
          <form className="admin-edit-box" onSubmit={onEditar}>
            <p className="config-meta">Editar autorizado</p>
            <label className="field-label">
              E-mail
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </label>
            <label className="field-label">
              ID transação Hotmart (opcional)
              <input value={editHotmart} onChange={(e) => setEditHotmart(e.target.value)} />
            </label>
            <label className="field-label">
              Observações
              <textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </label>
            <p className="config-meta">Atual: {descreveLicenca(editing)}</p>
            <CampoTipoLicenca
              tipo={editTipo}
              vencimento={editVence}
              onTipo={setEditTipo}
              onVencimento={setEditVence}
              permitirManter
            />
            <div className="admin-table-actions">
              <button className="btn btn-primary" type="submit" disabled={busy === `edit-${editing.id}`}>
                {busy === `edit-${editing.id}` ? 'Salvando…' : 'Salvar'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
        {items.length === 0 ? (
          <p className="config-meta">Nenhum e-mail liberado ainda.</p>
        ) : (
          <SyncedTable className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="col-principal">E-mail</th>
                  <th>Status</th>
                  <th>Tipo / vencimento</th>
                  <th>Desde</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="col-principal">{row.email}</td>
                    <td>{row.status}</td>
                    <td>{descreveLicenca(row)}</td>
                    <td>{formatDateBR(row.createdAt)}</td>
                    <td className="admin-table-actions">
                      <button className="btn btn-primary" type="button" onClick={() => startEdit(row)}>
                        Editar
                      </button>
                      <button
                        className="btn btn-revoke"
                        type="button"
                        disabled={busy === row.id || !(row.status === 'active' || row.status === 'trial')}
                        onClick={() => run(row.id, 'admin_revogar', { licenseId: row.id }, 'Acesso revogado.')}
                      >
                        Revogar
                      </button>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={busy === row.id || row.status === 'active' || row.status === 'trial'}
                        onClick={() => run(row.id, 'admin_reativar', { licenseId: row.id }, 'Acesso reativado.')}
                      >
                        Reativar
                      </button>
                      <button
                        className="btn btn-danger"
                        type="button"
                        disabled={busy === row.id}
                        onClick={() => onExcluir(row)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SyncedTable>
        )}
      </div>
    </div>
  )
}
