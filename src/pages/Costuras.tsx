import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { WhatsAppDialog } from '../components/WhatsAppDialog'
import { useLista, usePreferencias } from '../lib/hooks'
import { apagar } from '../lib/db'
import { useToast } from '../lib/toast'
import { ordemAberta, rotuloStatus, STATUS_ORDEM } from '../lib/costura'
import { compararNome, diasEntre, formatDateBR, formatHora, hojeISO, moeda } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { OrdemResumo } from '../lib/types'

type Filtro = 'abertas' | 'atrasadas' | 'semana' | 'prontas' | 'todas' | string

export function CosturasPage() {
  const navigate = useNavigate()
  const { rows, loading, error, reload } = useLista<OrdemResumo>('ordens_resumo', 'select=*&order=data_entrega.asc')
  const { prefs } = usePreferencias()
  const { push } = useToast()
  const [filtro, setFiltro] = useState<Filtro>('abertas')
  const [busca, setBusca] = useState('')
  const [whats, setWhats] = useState<OrdemResumo | null>(null)
  const hoje = hojeISO()

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return rows
      .filter((o) => {
        if (filtro === 'abertas') return ordemAberta(o.status)
        if (filtro === 'atrasadas') return ordemAberta(o.status) && o.status !== 'pronta' && o.data_entrega < hoje
        if (filtro === 'semana') return ordemAberta(o.status) && diasEntre(hoje, o.data_entrega) <= 7 && o.data_entrega >= hoje
        if (filtro === 'prontas') return o.status === 'pronta'
        if (filtro === 'todas') return true
        return o.status === filtro
      })
      .filter((o) => !t || o.cliente_nome.toLowerCase().includes(t) || String(o.numero) === t || (o.resumo_pecas || '').toLowerCase().includes(t))
      .sort((a, b) => compararNome(a.cliente_nome, b.cliente_nome) || a.data_entrega.localeCompare(b.data_entrega))
  }, [rows, filtro, busca, hoje])

  async function excluir(o: OrdemResumo) {
    if (!window.confirm(`Excluir a costura nº ${o.numero} de ${o.cliente_nome} e as peças dela? Os pagamentos ficam no caixa, sem ligação.`)) return
    const r = await apagar('ordens', o.id)
    if (r.error) return push('error', r.error)
    push('ok', 'Costura excluída.')
    void reload()
  }

  function exportar() {
    exportCsv(
      'costuras',
      ['Nº', 'Cliente', 'Peças', 'Recebida', 'Entrega', 'Situação', 'Total', 'Pago', 'Falta pagar'],
      filtradas.map((o) => [
        o.numero,
        o.cliente_nome,
        o.resumo_pecas,
        formatDateBR(o.data_recebimento),
        formatDateBR(o.data_entrega),
        rotuloStatus(o.status),
        Number(o.valor_total).toFixed(2).replace('.', ','),
        Number(o.valor_pago).toFixed(2).replace('.', ','),
        Number(o.saldo).toFixed(2).replace('.', ','),
      ]),
    )
  }

  const chips: { v: Filtro; l: string }[] = [
    { v: 'abertas', l: 'Em aberto' },
    { v: 'atrasadas', l: 'Atrasadas' },
    { v: 'semana', l: 'Entregar em 7 dias' },
    { v: 'prontas', l: 'Prontas' },
    { v: 'todas', l: 'Todas' },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Costuras"
        sub="Peças recebidas para ajuste, reforma e confecção. Toque no lápis para editar ou na lixeira para excluir."
        actions={
          <>
            <Link className="btn btn-primary" to="/app/costuras/nova">
              <Plus size={18} /> Receber costura
            </Link>
            <button className="btn btn-ghost" type="button" onClick={exportar} disabled={!filtradas.length}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      <div className="chips">
        {chips.map((c) => (
          <button key={c.v} type="button" className={`chip ${filtro === c.v ? 'chip--ativo' : ''}`} onClick={() => setFiltro(c.v)}>
            {c.l}
          </button>
        ))}
        <select className="chip-select" value={STATUS_ORDEM.some((s) => s.value === filtro) ? filtro : ''} onChange={(e) => e.target.value && setFiltro(e.target.value)} aria-label="Filtrar por situação">
          <option value="">Por situação…</option>
          {STATUS_ORDEM.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="search-box">
        <Search size={18} aria-hidden="true" />
        <input type="search" placeholder="Buscar por cliente, número ou peça" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar costura" />
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState texto={error} onRetry={reload} />
      ) : !filtradas.length ? (
        <EmptyState
          texto={rows.length ? 'Nenhuma costura neste filtro.' : 'Nenhuma costura ainda — registre a primeira peça recebida.'}
          acao={
            <Link className="btn btn-primary" to="/app/costuras/nova">
              <Plus size={18} /> Receber costura
            </Link>
          }
        />
      ) : (
        <SyncedTable className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Nº</th>
                <th>Entrega</th>
                <th>Situação</th>
                <th>Total</th>
                <th>Falta pagar</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => {
                const atrasada = ordemAberta(o.status) && o.status !== 'pronta' && o.data_entrega < hoje
                return (
                  <tr key={o.id} className={`row-click ${atrasada ? 'row-alerta' : ''}`} onClick={() => navigate(`/app/costuras/${o.id}`)}>
                    <td>
                      <div className="cell-main">
                        <strong>
                          {o.cliente_nome} {o.urgente ? <span className="badge badge--erro">Urgente</span> : null}
                        </strong>
                        <small>{o.resumo_pecas || 'sem peças'}</small>
                      </div>
                    </td>
                    <td>{o.numero}</td>
                    <td>
                      {formatDateBR(o.data_entrega)} {o.hora_entrega ? formatHora(o.hora_entrega) : ''}
                      {atrasada ? <small className="txt-erro block">Atrasada</small> : null}
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{moeda(o.valor_total)}</td>
                    <td className={Number(o.saldo) > 0 ? 'txt-erro' : 'txt-ok'}>{moeda(o.saldo)}</td>
                    <td>
                      <div className="acoes-linha">
                        <button
                          className="btn btn-whats btn-sm"
                          type="button"
                          aria-label="Avisar pelo WhatsApp"
                          disabled={!o.cliente_telefone}
                          onClick={(e) => {
                            e.stopPropagation()
                            setWhats(o)
                          }}
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button
                          className="icon-btn icon-btn--claro"
                          type="button"
                          aria-label="Editar costura"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/app/costuras/${o.id}`)
                          }}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="icon-btn icon-btn--claro"
                          type="button"
                          aria-label="Excluir costura"
                          onClick={(e) => {
                            e.stopPropagation()
                            void excluir(o)
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </SyncedTable>
      )}
      <p className="field-hint">{filtradas.length} costura(s)</p>
      {whats ? (
        <WhatsAppDialog
          alvo={whats}
          prefs={prefs}
          tipoInicial={whats.status === 'pronta' ? 'pronta' : Number(whats.saldo) > 0 && whats.status === 'entregue' ? 'cobranca' : 'lembrete'}
          onClose={() => setWhats(null)}
        />
      ) : null}
    </div>
  )
}
