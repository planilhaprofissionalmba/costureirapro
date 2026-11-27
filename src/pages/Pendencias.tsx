import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Download, MessageCircle } from 'lucide-react'
import { EmptyState, ErrorState, KpiCard, Loading, PageHeader, StatusBadge } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { WhatsAppDialog } from '../components/WhatsAppDialog'
import { LancamentoModal } from '../components/LancamentoModal'
import { atualizar } from '../lib/db'
import { useLista, usePreferencias } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { compararNome, diasEntre, formatDateBR, hojeISO, moeda } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { Cliente, Lancamento, OrdemResumo } from '../lib/types'

type Aba = 'devendo' | 'receber' | 'pagar'

export function PendenciasPage() {
  const { push } = useToast()
  const { prefs } = usePreferencias()
  const hoje = hojeISO()
  const ordens = useLista<OrdemResumo>('ordens_resumo', 'saldo=gt.0&status=neq.cancelada&order=data_entrega.asc')
  const agend = useLista<Lancamento>('lancamentos', 'status=eq.pendente&order=data_vencimento.asc')
  const clientes = useLista<Cliente>('clientes', 'select=id,nome_completo,telefone&order=nome_completo.asc')
  const [aba, setAba] = useState<Aba>('devendo')
  const [whats, setWhats] = useState<OrdemResumo | null>(null)
  const [novo, setNovo] = useState<'entrada' | 'saida' | null>(null)

  const devendo = useMemo(() => [...ordens.rows].sort((a, b) => compararNome(a.cliente_nome, b.cliente_nome) || a.numero - b.numero), [ordens.rows])
  const receber = agend.rows.filter((l) => l.tipo === 'entrada').sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
  const pagar = agend.rows.filter((l) => l.tipo === 'saida').sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
  const totDevendo = devendo.reduce((s, o) => s + Number(o.saldo), 0)
  const totReceber = receber.reduce((s, l) => s + Number(l.valor), 0)
  const totPagar = pagar.reduce((s, l) => s + Number(l.valor), 0)
  const nomeCliente = (id: string | null) => clientes.rows.find((c) => c.id === id)?.nome_completo || ''

  async function baixar(l: Lancamento) {
    const r = await atualizar('lancamentos', l.id, { status: 'pago', data_lancamento: hojeISO() })
    if (r.error) return push('error', r.error)
    push('ok', l.tipo === 'entrada' ? 'Recebido! Já está no caixa.' : 'Pago! Já está no caixa.')
    void agend.reload()
    void ordens.reload()
  }

  function exportar() {
    if (aba === 'devendo') {
      exportCsv('clientes-devendo', ['Cliente', 'Costura nº', 'Entrega', 'Total', 'Pago', 'Falta'], devendo.map((o) => [o.cliente_nome, o.numero, formatDateBR(o.data_entrega), moeda(o.valor_total), moeda(o.valor_pago), moeda(o.saldo)]))
    } else {
      const l = aba === 'receber' ? receber : pagar
      exportCsv(aba === 'receber' ? 'a-receber' : 'a-pagar', ['Vencimento', 'Descrição', 'Cliente', 'Valor'], l.map((x) => [formatDateBR(x.data_vencimento), x.descricao, nomeCliente(x.cliente_id), moeda(x.valor)]))
    }
  }

  const carregando = ordens.loading || agend.loading
  const erro = ordens.error || agend.error

  const tabelaAgendados = (lista: Lancamento[], tipo: 'entrada' | 'saida') =>
    !lista.length ? (
      <EmptyState texto={tipo === 'entrada' ? 'Nenhum recebimento agendado.' : 'Nenhum pagamento agendado.'} />
    ) : (
      <SyncedTable className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => {
              const atrasado = (l.data_vencimento || hoje) < hoje
              return (
                <tr key={l.id} className={atrasado ? 'row-alerta' : ''}>
                  <td>
                    <div className="cell-main">
                      <strong>{l.descricao}</strong>
                      <small>{[nomeCliente(l.cliente_id), l.categoria].filter(Boolean).join(' · ')}</small>
                    </div>
                  </td>
                  <td>
                    {formatDateBR(l.data_vencimento)}
                    {atrasado ? <small className="txt-erro block">Atrasado {diasEntre(l.data_vencimento!, hoje)} dia(s)</small> : null}
                  </td>
                  <td>{moeda(l.valor)}</td>
                  <td>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => void baixar(l)}>
                      {tipo === 'entrada' ? 'Recebi' : 'Paguei'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </SyncedTable>
    )

  return (
    <div className="page">
      <PageHeader
        title="Pendências"
        sub="Quem ainda não pagou, o que você vai receber e o que precisa pagar."
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => setNovo('entrada')}>
              <CalendarClock size={18} /> Agendar recebimento
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setNovo('saida')}>
              <CalendarClock size={18} /> Agendar pagamento
            </button>
            <button className="btn btn-ghost" type="button" onClick={exportar}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      <div className="kpi-row">
        <KpiCard titulo="Clientes devendo" valor={moeda(totDevendo)} detalhe={`${new Set(devendo.map((o) => o.cliente_id)).size} cliente(s)`} tom={totDevendo ? 'erro' : 'ok'} onClick={() => setAba('devendo')} />
        <KpiCard titulo="A receber agendado" valor={moeda(totReceber)} detalhe={`${receber.length} lançamento(s)`} tom="ok" onClick={() => setAba('receber')} />
        <KpiCard titulo="A pagar agendado" valor={moeda(totPagar)} detalhe={`${pagar.length} conta(s)`} tom={totPagar ? 'alerta' : 'neutro'} onClick={() => setAba('pagar')} />
      </div>
      <div className="chips">
        <button type="button" className={`chip ${aba === 'devendo' ? 'chip--ativo' : ''}`} onClick={() => setAba('devendo')}>
          Clientes que não pagaram
        </button>
        <button type="button" className={`chip ${aba === 'receber' ? 'chip--ativo' : ''}`} onClick={() => setAba('receber')}>
          A receber
        </button>
        <button type="button" className={`chip ${aba === 'pagar' ? 'chip--ativo' : ''}`} onClick={() => setAba('pagar')}>
          A pagar
        </button>
      </div>
      {carregando ? (
        <Loading />
      ) : erro ? (
        <ErrorState texto={erro} onRetry={() => void ordens.reload()} />
      ) : aba === 'devendo' ? (
        !devendo.length ? (
          <EmptyState texto="Ninguém devendo. Tudo pago!" />
        ) : (
          <SyncedTable className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Costura</th>
                  <th>Situação</th>
                  <th>Total</th>
                  <th>Falta pagar</th>
                  <th>Cobrar</th>
                </tr>
              </thead>
              <tbody>
                {devendo.map((o) => (
                  <tr key={o.id} className={o.status === 'entregue' ? 'row-alerta' : ''}>
                    <td>
                      <div className="cell-main">
                        <strong>{o.cliente_nome}</strong>
                        <small>{o.resumo_pecas}</small>
                      </div>
                    </td>
                    <td>
                      <Link to={`/app/costuras/${o.id}`}>Nº {o.numero}</Link>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{moeda(o.valor_total)}</td>
                    <td className="txt-erro">
                      <strong>{moeda(o.saldo)}</strong>
                    </td>
                    <td>
                      <button className="btn btn-whats btn-sm" type="button" disabled={!o.cliente_telefone} onClick={() => setWhats(o)}>
                        <MessageCircle size={16} /> Cobrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SyncedTable>
        )
      ) : aba === 'receber' ? (
        tabelaAgendados(receber, 'entrada')
      ) : (
        tabelaAgendados(pagar, 'saida')
      )}
      {whats ? <WhatsAppDialog alvo={whats} prefs={prefs} tipoInicial="cobranca" onClose={() => setWhats(null)} /> : null}
      {novo ? (
        <LancamentoModal
          inicial={{ tipo: novo, status: 'pendente' }}
          clientes={clientes.rows}
          onClose={() => setNovo(null)}
          onSalvo={() => void agend.reload()}
        />
      ) : null}
    </div>
  )
}
