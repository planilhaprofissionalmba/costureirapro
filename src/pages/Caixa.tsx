import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Download, Pencil, Trash2 } from 'lucide-react'
import { EmptyState, ErrorState, KpiCard, Loading, PageHeader } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { LancamentoModal } from '../components/LancamentoModal'
import { apagar, atualizar } from '../lib/db'
import { useLista } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { compararNome, formatDateBR, hojeISO, isoLocal, moeda } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { Cliente, Lancamento } from '../lib/types'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function CaixaPage() {
  const { push } = useToast()
  const [mes, setMes] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const inicio = isoLocal(mes)
  const fim = isoLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
  const { rows, loading, error, reload } = useLista<Lancamento>('lancamentos', `data_lancamento=gte.${inicio}&data_lancamento=lte.${fim}&order=data_lancamento.desc`)
  const saldoGeral = useLista<Pick<Lancamento, 'tipo' | 'valor'>>('lancamentos', 'status=eq.pago&select=tipo,valor')
  const clientes = useLista<Cliente>('clientes', 'select=id,nome_completo&order=nome_completo.asc')
  const [filtro, setFiltro] = useState<'todos' | 'entrada' | 'saida' | 'pendente'>('todos')
  const [modal, setModal] = useState<(Partial<Lancamento> & { tipo: 'entrada' | 'saida' }) | null>(null)

  const pagos = rows.filter((l) => l.status === 'pago')
  const entradas = pagos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0)
  const saidas = pagos.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0)
  const caixaHoje = saldoGeral.rows.reduce((s, l) => s + (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor), 0)

  const lista = useMemo(
    () =>
      rows
        .filter((l) => (filtro === 'todos' ? true : filtro === 'pendente' ? l.status === 'pendente' : l.tipo === filtro))
        .sort((a, b) => compararNome(a.descricao, b.descricao) || b.data_lancamento.localeCompare(a.data_lancamento)),
    [rows, filtro],
  )

  async function recarregar() {
    await Promise.all([reload(), saldoGeral.reload()])
  }

  async function marcarPago(l: Lancamento) {
    const r = await atualizar('lancamentos', l.id, { status: 'pago', data_lancamento: hojeISO() })
    if (r.error) return push('error', r.error)
    push('ok', l.tipo === 'entrada' ? 'Recebido!' : 'Pago!')
    void recarregar()
  }

  async function excluir(l: Lancamento) {
    if (!window.confirm(`Excluir "${l.descricao}"?`)) return
    const r = await apagar('lancamentos', l.id)
    if (r.error) return push('error', r.error)
    push('ok', 'Lançamento excluído.')
    void recarregar()
  }

  function exportar() {
    exportCsv(
      `caixa-${inicio.slice(0, 7)}`,
      ['Data', 'Tipo', 'Situação', 'Categoria', 'Descrição', 'Forma', 'Valor'],
      lista.map((l) => [
        formatDateBR(l.data_lancamento),
        l.tipo === 'entrada' ? 'Entrada' : 'Saída',
        l.status === 'pago' ? 'Pago' : 'Agendado',
        l.categoria,
        l.descricao,
        l.forma_pagamento,
        (l.tipo === 'saida' ? -1 : 1) * Number(l.valor),
      ]).map((r) => r.map((v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v))),
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Caixa"
        sub="Tudo o que entrou e saiu de dinheiro. Agendados aparecem também em Pendências e na Agenda."
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => setModal({ tipo: 'entrada' })}>
              <ArrowUpCircle size={18} /> Entrada
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setModal({ tipo: 'saida' })}>
              <ArrowDownCircle size={18} /> Saída
            </button>
            <button className="btn btn-ghost" type="button" onClick={exportar} disabled={!lista.length}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      <div className="mes-nav">
        <button className="icon-btn icon-btn--claro" type="button" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>
          <ChevronLeft size={22} />
        </button>
        <strong>
          {MESES[mes.getMonth()]} de {mes.getFullYear()}
        </strong>
        <button className="icon-btn icon-btn--claro" type="button" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="kpi-row">
        <KpiCard titulo="Entrou no mês" valor={moeda(entradas)} tom="ok" />
        <KpiCard titulo="Saiu no mês" valor={moeda(saidas)} tom="erro" />
        <KpiCard titulo="Resultado do mês" valor={moeda(entradas - saidas)} tom={entradas - saidas >= 0 ? 'ok' : 'erro'} />
        <KpiCard titulo="Saldo do caixa (tudo)" valor={moeda(caixaHoje)} tom={caixaHoje >= 0 ? 'ok' : 'erro'} />
      </div>
      <div className="chips">
        {(
          [
            ['todos', 'Todos'],
            ['entrada', 'Entradas'],
            ['saida', 'Saídas'],
            ['pendente', 'Agendados'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" className={`chip ${filtro === v ? 'chip--ativo' : ''}`} onClick={() => setFiltro(v)}>
            {l}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState texto={error} onRetry={reload} />
      ) : !lista.length ? (
        <EmptyState texto="Nenhum lançamento neste mês." />
      ) : (
        <SyncedTable className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Data</th>
                <th>Categoria</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="cell-main">
                      <strong>{l.descricao}</strong>
                      {l.status === 'pendente' ? <small className="txt-alerta">Agendado</small> : null}
                    </div>
                  </td>
                  <td>{formatDateBR(l.data_lancamento)}</td>
                  <td>{l.categoria}</td>
                  <td>{l.forma_pagamento || '—'}</td>
                  <td className={l.tipo === 'entrada' ? 'txt-ok' : 'txt-erro'}>
                    {l.tipo === 'entrada' ? '+ ' : '− '}
                    {moeda(l.valor)}
                  </td>
                  <td>
                    <div className="acoes-linha">
                      {l.status === 'pendente' ? (
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => void marcarPago(l)}>
                          {l.tipo === 'entrada' ? 'Recebi' : 'Paguei'}
                        </button>
                      ) : null}
                      <button className="icon-btn icon-btn--claro" type="button" aria-label="Editar" onClick={() => setModal(l)}>
                        <Pencil size={18} />
                      </button>
                      <button className="icon-btn icon-btn--claro" type="button" aria-label="Excluir" onClick={() => void excluir(l)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SyncedTable>
      )}
      {modal ? <LancamentoModal inicial={modal} clientes={clientes.rows} onClose={() => setModal(null)} onSalvo={() => void recarregar()} /> : null}
    </div>
  )
}
