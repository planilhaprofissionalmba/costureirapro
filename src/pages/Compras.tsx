import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { EmptyState, ErrorState, Field, Loading, Modal, MoneyInput, PageHeader } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { useAuth } from '../lib/auth'
import { apagar, inserir } from '../lib/db'
import { useLista } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { FORMAS_PAGAMENTO } from '../lib/costura'
import { compararNome, formatDateBR, hojeISO, moeda, numeroBR, parseMoeda } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { Compra, Movimento, Produto } from '../lib/types'

type LinhaCompra = { produto: string; qtd: string; custo: string }

export function ComprasPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const compras = useLista<Compra>('compras', 'order=data_compra.desc&limit=300')
  const produtos = useLista<Produto>('produtos', 'ativo=eq.true&order=nome.asc')
  const movs = useLista<Movimento>('movimentos_estoque', 'compra_id=not.is.null&select=id,compra_id,produto_id,quantidade,custo_unitario')
  const [aberta, setAberta] = useState(false)
  const [fornecedor, setFornecedor] = useState('')
  const [data, setData] = useState(hojeISO())
  const [forma, setForma] = useState('Pix')
  const [pago, setPago] = useState(true)
  const [vencimento, setVencimento] = useState(hojeISO())
  const [obs, setObs] = useState('')
  const [linhas, setLinhas] = useState<LinhaCompra[]>([{ produto: '', qtd: '1', custo: '' }])
  const [busy, setBusy] = useState(false)

  const total = linhas.reduce((s, l) => s + (Number(l.qtd.replace(',', '.')) || 0) * parseMoeda(l.custo), 0)
  const nomeProduto = (id: string) => produtos.rows.find((p) => p.id === id)?.nome || 'Produto'
  const itensDaCompra = useMemo(() => {
    const m = new Map<string, Movimento[]>()
    movs.rows.forEach((x) => x.compra_id && m.set(x.compra_id, [...(m.get(x.compra_id) || []), x]))
    return m
  }, [movs.rows])

  function limpar() {
    setFornecedor('')
    setData(hojeISO())
    setForma('Pix')
    setPago(true)
    setVencimento(hojeISO())
    setObs('')
    setLinhas([{ produto: '', qtd: '1', custo: '' }])
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const validas = linhas.filter((l) => l.produto && Number(l.qtd.replace(',', '.')) > 0)
    if (!validas.length) return push('warn', 'Escolha pelo menos um produto com quantidade.')
    setBusy(true)
    const r = await inserir<Compra>('compras', {
      account_id: user.accountId,
      fornecedor: fornecedor.trim() || null,
      data_compra: data,
      valor_total: Math.round(total * 100) / 100,
      forma_pagamento: forma,
      observacoes: obs.trim() || null,
    })
    const compra = r.data?.[0]
    if (r.error || !compra) {
      setBusy(false)
      return push('error', r.error || 'Não foi possível salvar a compra.')
    }
    const m = await inserir(
      'movimentos_estoque',
      validas.map((l) => ({
        account_id: user.accountId,
        produto_id: l.produto,
        tipo: 'entrada',
        quantidade: Number(l.qtd.replace(',', '.')),
        custo_unitario: parseMoeda(l.custo) || null,
        data_movimento: data,
        compra_id: compra.id,
        observacao: fornecedor.trim() ? `Compra em ${fornecedor.trim()}` : 'Compra',
      })),
    )
    let erroCaixa: string | undefined
    if (total > 0) {
      const c = await inserir('lancamentos', {
        account_id: user.accountId,
        tipo: 'saida',
        status: pago ? 'pago' : 'pendente',
        categoria: 'Compra de material',
        descricao: `Compra${fornecedor.trim() ? ` - ${fornecedor.trim()}` : ''}`,
        valor: Math.round(total * 100) / 100,
        data_lancamento: pago ? data : vencimento,
        data_vencimento: pago ? null : vencimento,
        forma_pagamento: forma,
        compra_id: compra.id,
      })
      erroCaixa = c.error
    }
    setBusy(false)
    if (m.error || erroCaixa) push('warn', `Compra salva, mas algo não foi gravado: ${m.error || erroCaixa}`)
    else push('ok', pago ? 'Compra salva: estoque e caixa atualizados.' : 'Compra salva: estoque atualizado e pagamento agendado.')
    setAberta(false)
    limpar()
    void compras.reload()
    void movs.reload()
    void produtos.reload()
  }

  async function excluir(c: Compra) {
    if (!window.confirm('Excluir esta compra? O estoque e o caixa dela também serão desfeitos.')) return
    const r = await apagar('compras', c.id)
    if (r.error) return push('error', r.error)
    push('ok', 'Compra excluída.')
    void compras.reload()
    void movs.reload()
  }

  function exportar() {
    exportCsv(
      'compras',
      ['Data', 'Fornecedor', 'Itens', 'Forma', 'Total'],
      compras.rows.map((c) => [
        formatDateBR(c.data_compra),
        c.fornecedor,
        (itensDaCompra.get(c.id) || []).map((m) => `${numeroBR(Number(m.quantidade), 2)} ${nomeProduto(m.produto_id)}`).join(', '),
        c.forma_pagamento,
        Number(c.valor_total).toFixed(2).replace('.', ','),
      ]),
    )
  }

  const ordenadas = [...compras.rows].sort((a, b) => compararNome(a.fornecedor || 'Sem fornecedor', b.fornecedor || 'Sem fornecedor') || b.data_compra.localeCompare(a.data_compra))

  return (
    <div className="page">
      <PageHeader
        title="Compras"
        sub="Registre o que comprou: o estoque sobe sozinho e o gasto vai para o caixa (ou para pagar depois)."
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => setAberta(true)} disabled={!produtos.rows.length}>
              <ShoppingCart size={18} /> Nova compra
            </button>
            <button className="btn btn-ghost" type="button" onClick={exportar} disabled={!compras.rows.length}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      {!produtos.loading && !produtos.rows.length ? (
        <div className="alert alert-warn">
          Primeiro cadastre os produtos em <Link to="/app/estoque">Estoque</Link> (ex.: linha, agulha, óleo). Depois registre as compras aqui.
        </div>
      ) : null}
      {compras.loading ? (
        <Loading />
      ) : compras.error ? (
        <ErrorState texto={compras.error} onRetry={compras.reload} />
      ) : !ordenadas.length ? (
        <EmptyState texto="Nenhuma compra registrada ainda." />
      ) : (
        <SyncedTable className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="cell-main">
                      <strong>{c.fornecedor || 'Sem fornecedor'}</strong>
                      <small>{c.forma_pagamento || ''}</small>
                    </div>
                  </td>
                  <td>{formatDateBR(c.data_compra)}</td>
                  <td>{(itensDaCompra.get(c.id) || []).map((m) => `${numeroBR(Number(m.quantidade), 2)} ${nomeProduto(m.produto_id)}`).join(', ') || '—'}</td>
                  <td>{moeda(c.valor_total)}</td>
                  <td>
                    <button className="icon-btn icon-btn--claro" type="button" aria-label="Excluir compra" onClick={() => void excluir(c)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SyncedTable>
      )}

      {aberta ? (
        <Modal titulo="Nova compra" onClose={() => setAberta(false)} largo>
          <form className="stack" onSubmit={salvar}>
            <div className="form-grid">
              <Field label="Loja / fornecedor" htmlFor="cp-forn">
                <input id="cp-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Armarinho Central" />
              </Field>
              <Field label="Data da compra" htmlFor="cp-data">
                <input id="cp-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Field>
              <Field label="Forma de pagamento" htmlFor="cp-forma">
                <select id="cp-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
            </div>
            <h3 className="sub-title">Itens comprados</h3>
            {linhas.map((l, i) => (
              <div key={i} className="linha-compra">
                <select aria-label={`Produto ${i + 1}`} value={l.produto} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, produto: e.target.value } : x)))}>
                  <option value="">Produto…</option>
                  {produtos.rows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.unidade})
                    </option>
                  ))}
                </select>
                <input aria-label="Quantidade" inputMode="decimal" value={l.qtd} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, qtd: e.target.value.replace(/[^\d.,]/g, '') } : x)))} />
                <MoneyInput value={l.custo} onChange={(v) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, custo: v } : x)))} placeholder="custo cada" />
                {linhas.length > 1 ? (
                  <button className="icon-btn icon-btn--claro" type="button" aria-label="Tirar item" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                    <Trash2 size={18} />
                  </button>
                ) : null}
              </div>
            ))}
            <button className="btn btn-secondary" type="button" onClick={() => setLinhas((ls) => [...ls, { produto: '', qtd: '1', custo: '' }])}>
              <Plus size={16} /> Mais um item
            </button>
            <p className="totais-linha">
              Total da compra: <strong>{moeda(total)}</strong>
            </p>
            <label className="checkbox">
              <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
              <span>Já paguei</span>
            </label>
            {!pago ? (
              <Field label="Vou pagar em" htmlFor="cp-venc">
                <input id="cp-venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </Field>
            ) : null}
            <Field label="Observações" htmlFor="cp-obs">
              <input id="cp-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
            </Field>
            <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar compra'}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
