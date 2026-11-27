import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, MessageCircle, Search, UserPlus } from 'lucide-react'
import { EmptyState, ErrorState, Loading, PageHeader } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { WhatsAppDialog } from '../components/WhatsAppDialog'
import { useLista, usePreferencias } from '../lib/hooks'
import { compararNome, mascaraCpf, mascaraTelefone } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { Cliente } from '../lib/types'

export function ClientesPage() {
  const navigate = useNavigate()
  const { rows, loading, error, reload } = useLista<Cliente>('clientes', 'select=*&order=nome_completo.asc')
  const { prefs } = usePreferencias()
  const [busca, setBusca] = useState('')
  const [whats, setWhats] = useState<Cliente | null>(null)

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const digitos = t.replace(/\D/g, '')
    return rows
      .filter((c) => {
        if (!t) return true
        return (
          c.nome_completo.toLowerCase().includes(t) ||
          (c.bairro || '').toLowerCase().includes(t) ||
          (c.cidade || '').toLowerCase().includes(t) ||
          (digitos.length >= 3 && ((c.cpf || '').includes(digitos) || (c.telefone || '').includes(digitos)))
        )
      })
      .sort((a, b) => compararNome(a.nome_completo, b.nome_completo))
  }, [rows, busca])

  function exportar() {
    exportCsv(
      'clientes',
      ['Nome completo', 'CPF', 'Telefone', 'E-mail', 'Bairro', 'Cidade', 'UF', 'Como conheceu'],
      filtrados.map((c) => [c.nome_completo, mascaraCpf(c.cpf), mascaraTelefone(c.telefone), c.email, c.bairro, c.cidade, c.uf, c.como_conheceu]),
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Clientes"
        sub="Todas as suas clientes em ordem alfabética. Toque no nome para ver medidas, costuras e pagamentos."
        actions={
          <>
            <Link className="btn btn-primary" to="/app/clientes/nova">
              <UserPlus size={18} /> Nova cliente
            </Link>
            <button className="btn btn-ghost" type="button" onClick={exportar} disabled={!filtrados.length}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      <div className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por nome, telefone, CPF, bairro ou cidade"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar cliente"
        />
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState texto={error} onRetry={reload} />
      ) : !filtrados.length ? (
        <EmptyState
          texto={busca ? 'Nenhuma cliente encontrada nessa busca.' : 'Nenhuma cliente ainda — cadastre a primeira.'}
          acao={
            <Link className="btn btn-primary" to="/app/clientes/nova">
              <UserPlus size={18} /> Cadastrar cliente
            </Link>
          }
        />
      ) : (
        <SyncedTable className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Bairro / cidade</th>
                <th>CPF</th>
                <th>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="row-click" onClick={() => navigate(`/app/clientes/${c.id}`)}>
                  <td>
                    <div className="cell-main">
                      <strong>{c.nome_completo}</strong>
                      {c.email ? <small>{c.email}</small> : null}
                    </div>
                  </td>
                  <td>{c.telefone ? mascaraTelefone(c.telefone) : '—'}</td>
                  <td>{[c.bairro, c.cidade].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{c.cpf ? mascaraCpf(c.cpf) : '—'}</td>
                  <td>
                    <button
                      className="btn btn-whats btn-sm"
                      type="button"
                      disabled={!c.telefone}
                      onClick={(e) => {
                        e.stopPropagation()
                        setWhats(c)
                      }}
                    >
                      <MessageCircle size={16} /> Enviar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SyncedTable>
      )}
      <p className="field-hint">{filtrados.length} cliente(s)</p>

      {whats ? (
        <WhatsAppDialog
          alvo={{ cliente_nome: whats.nome_completo, cliente_telefone: whats.telefone, cliente_id: whats.id }}
          prefs={prefs}
          tipoInicial="livre"
          onClose={() => setWhats(null)}
        />
      ) : null}
    </div>
  )
}
