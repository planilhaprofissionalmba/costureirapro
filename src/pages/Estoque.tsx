import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Download, History, PackagePlus, Pencil, Search, ShoppingCart, SlidersHorizontal } from 'lucide-react'
import { EmptyState, ErrorState, Field, ListaOpcoes, Loading, Modal, MoneyInput, PageHeader } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { useAuth } from '../lib/auth'
import { atualizar, inserir, listar } from '../lib/db'
import { useLista } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { CATEGORIAS_PRODUTO, UNIDADES } from '../lib/costura'
import { compararNome, formatDateBR, hojeISO, mascaraMoeda, moeda, numeroBR, parseMoeda } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { Movimento, Produto } from '../lib/types'

type FormProduto = { id?: string; nome: string; categoria: string; unidade: string; cor: string; minimo: string; custo: string; inicial: string; obs: string; ativo: boolean }
const VAZIO: FormProduto = { nome: '', categoria: 'Linha', unidade: 'un', cor: '', minimo: '1', custo: '', inicial: '', obs: '', ativo: true }

function num(v: string) {
  return Number(String(v || '').replace(',', '.')) || 0
}

export function EstoquePage() {
  const { user } = useAuth()
  const { push } = useToast()
  const { rows, loading, error, reload } = useLista<Produto>('produtos', 'order=nome.asc')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [form, setForm] = useState<FormProduto | null>(null)
  const [mov, setMov] = useState<{ produto: Produto; tipo: 'entrada' | 'saida' | 'ajuste' } | null>(null)
  const [hist, setHist] = useState<{ produto: Produto; itens: Movimento[] } | null>(null)

  const filtrados = useMemo(
    () =>
      rows
        .filter((p) => !categoria || p.categoria === categoria)
        .filter((p) => !busca.trim() || `${p.nome} ${p.cor || ''} ${p.categoria}`.toLowerCase().includes(busca.trim().toLowerCase()))
        .sort((a, b) => compararNome(a.nome, b.nome)),
    [rows, busca, categoria],
  )
  const baixos = rows.filter((p) => p.ativo && Number(p.estoque_atual) <= Number(p.estoque_minimo))
  const valorEstoque = rows.reduce((s, p) => s + Math.max(Number(p.estoque_atual), 0) * Number(p.custo_medio), 0)

  async function salvarProduto(e: FormEvent) {
    e.preventDefault()
    if (!user || !form) return
    if (!form.nome.trim()) return push('warn', 'Informe o nome do produto.')
    const linha = {
      nome: form.nome.trim(),
      categoria: form.categoria || 'Outros',
      unidade: form.unidade || 'un',
      cor: form.cor.trim() || null,
      estoque_minimo: num(form.minimo),
      observacoes: form.obs.trim() || null,
      ativo: form.ativo,
      ...(form.id ? {} : { custo_medio: parseMoeda(form.custo) }),
    }
    const r = form.id ? await atualizar<Produto>('produtos', form.id, linha) : await inserir<Produto>('produtos', { ...linha, account_id: user.accountId })
    if (r.error) return push('error', r.error)
    const novo = r.data?.[0]
    if (!form.id && novo && num(form.inicial) > 0) {
      await inserir('movimentos_estoque', {
        account_id: user.accountId,
        produto_id: novo.id,
        tipo: 'entrada',
        quantidade: num(form.inicial),
        custo_unitario: parseMoeda(form.custo) || null,
        observacao: 'Estoque inicial',
      })
    }
    push('ok', 'Produto salvo.')
    setForm(null)
    void reload()
  }

  async function abrirHistorico(p: Produto) {
    const r = await listar<Movimento>('movimentos_estoque', `produto_id=eq.${p.id}&order=created_at.desc&limit=50`)
    if (r.error) return push('error', r.error)
    setHist({ produto: p, itens: r.data || [] })
  }

  function exportar() {
    exportCsv(
      'estoque',
      ['Produto', 'Categoria', 'Cor', 'Unidade', 'Em estoque', 'Mínimo', 'Custo médio'],
      filtrados.map((p) => [p.nome, p.categoria, p.cor, p.unidade, numeroBR(Number(p.estoque_atual), 2), numeroBR(Number(p.estoque_minimo), 2), Number(p.custo_medio).toFixed(2).replace('.', ',')]),
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Estoque"
        sub="Linhas, agulhas, óleo de máquina, zíperes, botões… Saiba o que tem e o que está acabando."
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => setForm({ ...VAZIO })}>
              <PackagePlus size={18} /> Novo produto
            </button>
            <Link className="btn btn-secondary" to="/app/compras">
              <ShoppingCart size={18} /> Registrar compra
            </Link>
            <button className="btn btn-ghost" type="button" onClick={exportar} disabled={!filtrados.length}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-top">Produtos cadastrados</div>
          <strong className="kpi-valor">{rows.length}</strong>
        </div>
        <div className={`kpi ${baixos.length ? 'kpi--alerta' : 'kpi--ok'}`}>
          <div className="kpi-top">Acabando</div>
          <strong className="kpi-valor">{baixos.length}</strong>
        </div>
        <div className="kpi">
          <div className="kpi-top">Valor em estoque</div>
          <strong className="kpi-valor">{moeda(valorEstoque)}</strong>
        </div>
      </div>

      {baixos.length ? (
        <div className="alert alert-warn">
          <AlertTriangle size={16} /> Comprar logo: {baixos.map((p) => p.nome).sort(compararNome).join(', ')}.
        </div>
      ) : null}

      <div className="filtros">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        </div>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar categoria">
          <option value="">Todas as categorias</option>
          {[...CATEGORIAS_PRODUTO].sort(compararNome).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState texto={error} onRetry={reload} />
      ) : !filtrados.length ? (
        <EmptyState
          texto={rows.length ? 'Nenhum produto neste filtro.' : 'Nenhum produto ainda — cadastre suas linhas, agulhas e óleo.'}
          acao={
            <button className="btn btn-primary" type="button" onClick={() => setForm({ ...VAZIO })}>
              <PackagePlus size={18} /> Cadastrar produto
            </button>
          }
        />
      ) : (
        <SyncedTable className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Em estoque</th>
                <th>Mínimo</th>
                <th>Custo médio</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const baixo = Number(p.estoque_atual) <= Number(p.estoque_minimo)
                return (
                  <tr key={p.id} className={baixo && p.ativo ? 'row-alerta' : ''}>
                    <td>
                      <div className="cell-main">
                        <strong>
                          {p.nome} {!p.ativo ? <span className="badge badge--apagado">Inativo</span> : null}
                        </strong>
                        <small>{[p.categoria, p.cor].filter(Boolean).join(' · ')}</small>
                      </div>
                    </td>
                    <td className={baixo ? 'txt-erro' : ''}>
                      <strong>{numeroBR(Number(p.estoque_atual), Number.isInteger(Number(p.estoque_atual)) ? 0 : 2)}</strong> {p.unidade}
                    </td>
                    <td>
                      {numeroBR(Number(p.estoque_minimo))} {p.unidade}
                    </td>
                    <td>{moeda(p.custo_medio)}</td>
                    <td>
                      <div className="acoes-linha">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMov({ produto: p, tipo: 'entrada' })} title="Entrou no estoque">
                          <ArrowUpCircle size={16} /> Entrou
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMov({ produto: p, tipo: 'saida' })} title="Usei / saiu do estoque">
                          <ArrowDownCircle size={16} /> Usei
                        </button>
                        <button className="icon-btn icon-btn--claro" type="button" aria-label="Ajustar quantidade" onClick={() => setMov({ produto: p, tipo: 'ajuste' })}>
                          <SlidersHorizontal size={18} />
                        </button>
                        <button className="icon-btn icon-btn--claro" type="button" aria-label="Histórico" onClick={() => void abrirHistorico(p)}>
                          <History size={18} />
                        </button>
                        <button
                          className="icon-btn icon-btn--claro"
                          type="button"
                          aria-label="Editar produto"
                          onClick={() =>
                            setForm({
                              id: p.id,
                              nome: p.nome,
                              categoria: p.categoria,
                              unidade: p.unidade,
                              cor: p.cor || '',
                              minimo: String(p.estoque_minimo).replace('.', ','),
                              custo: mascaraMoeda(Number(p.custo_medio).toFixed(2)),
                              inicial: '',
                              obs: p.observacoes || '',
                              ativo: p.ativo,
                            })
                          }
                        >
                          <Pencil size={18} />
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

      {form ? (
        <Modal titulo={form.id ? 'Editar produto' : 'Novo produto'} onClose={() => setForm(null)}>
          <form className="form-grid" onSubmit={salvarProduto}>
            <div className="field span-all">
              <label className="field-label" htmlFor="p-nome">
                Nome *
              </label>
              <input id="p-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Linha de poliéster 120" />
            </div>
            <Field label="Categoria" htmlFor="p-cat">
              <input id="p-cat" list="lista-cat" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </Field>
            <Field label="Unidade" htmlFor="p-un">
              <input id="p-un" list="lista-un" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            </Field>
            <Field label="Cor" htmlFor="p-cor">
              <input id="p-cor" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
            </Field>
            <Field label="Avisar quando tiver só" htmlFor="p-min" dica="Estoque mínimo">
              <input id="p-min" inputMode="decimal" value={form.minimo} onChange={(e) => setForm({ ...form, minimo: e.target.value.replace(/[^\d.,]/g, '') })} />
            </Field>
            {!form.id ? (
              <>
                <Field label="Quantidade que tenho hoje" htmlFor="p-ini">
                  <input id="p-ini" inputMode="decimal" value={form.inicial} onChange={(e) => setForm({ ...form, inicial: e.target.value.replace(/[^\d.,]/g, '') })} />
                </Field>
                <Field label="Custo de cada um" htmlFor="p-custo">
                  <MoneyInput id="p-custo" value={form.custo} onChange={(v) => setForm({ ...form, custo: v })} />
                </Field>
              </>
            ) : (
              <label className="checkbox field">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                <span>Produto ativo</span>
              </label>
            )}
            <div className="field span-all">
              <label className="field-label" htmlFor="p-obs">
                Observações
              </label>
              <textarea id="p-obs" rows={2} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
            </div>
            <button className="btn btn-primary span-all" type="submit">
              Salvar produto
            </button>
          </form>
          <ListaOpcoes id="lista-cat" opcoes={CATEGORIAS_PRODUTO} />
          <ListaOpcoes id="lista-un" opcoes={UNIDADES} />
        </Modal>
      ) : null}

      {mov ? <MovimentoModal {...mov} onClose={() => setMov(null)} onSalvo={() => void reload()} /> : null}

      {hist ? (
        <Modal titulo={`Histórico: ${hist.produto.nome}`} onClose={() => setHist(null)}>
          {hist.itens.length ? (
            <ul className="lista-simples">
              {hist.itens.map((m) => (
                <li key={m.id}>
                  <span>
                    {formatDateBR(m.data_movimento)} · {m.tipo === 'entrada' ? 'Entrou' : m.tipo === 'saida' ? 'Saiu' : 'Ajuste'} ·{' '}
                    {m.observacao || ''}
                  </span>
                  <strong className={m.tipo === 'saida' || Number(m.quantidade) < 0 ? 'txt-erro' : 'txt-ok'}>
                    {m.tipo === 'saida' ? '−' : Number(m.quantidade) > 0 ? '+' : ''}
                    {numeroBR(Math.abs(Number(m.quantidade)), 2)} {hist.produto.unidade}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="page-sub">Nenhuma movimentação ainda.</p>
          )}
        </Modal>
      ) : null}
    </div>
  )
}

function MovimentoModal({ produto, tipo, onClose, onSalvo }: { produto: Produto; tipo: 'entrada' | 'saida' | 'ajuste'; onClose: () => void; onSalvo: () => void }) {
  const { user } = useAuth()
  const { push } = useToast()
  const [qtd, setQtd] = useState(tipo === 'ajuste' ? String(produto.estoque_atual).replace('.', ',') : '1')
  const [custo, setCusto] = useState('')
  const [data, setData] = useState(hojeISO())
  const [obs, setObs] = useState('')
  const titulo = tipo === 'entrada' ? 'Entrou no estoque' : tipo === 'saida' ? 'Usei / saiu do estoque' : 'Contei e corrigi a quantidade'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const q = num(qtd)
    let quantidade = q
    if (tipo === 'ajuste') {
      quantidade = Math.round((q - Number(produto.estoque_atual)) * 1000) / 1000
      if (quantidade === 0) {
        onClose()
        return
      }
    } else if (!(q > 0)) {
      return push('warn', 'Informe a quantidade.')
    }
    const r = await inserir('movimentos_estoque', {
      account_id: user.accountId,
      produto_id: produto.id,
      tipo,
      quantidade,
      custo_unitario: tipo === 'entrada' ? parseMoeda(custo) || null : null,
      data_movimento: data,
      observacao: obs.trim() || (tipo === 'ajuste' ? 'Contagem do estoque' : null),
    })
    if (r.error) return push('error', r.error)
    push('ok', 'Estoque atualizado.')
    onSalvo()
    onClose()
  }

  return (
    <Modal titulo={`${titulo}: ${produto.nome}`} onClose={onClose}>
      <form className="stack" onSubmit={salvar}>
        <p className="page-sub">
          Hoje tem: <strong>{numeroBR(Number(produto.estoque_atual), 2)} {produto.unidade}</strong>
        </p>
        <Field label={tipo === 'ajuste' ? `Quantidade que tem agora (${produto.unidade})` : `Quantidade (${produto.unidade})`} htmlFor="mv-qtd">
          <input id="mv-qtd" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ''))} />
        </Field>
        {tipo === 'entrada' ? (
          <Field label="Custo de cada um (opcional)" htmlFor="mv-custo" dica="Para compras com nota, use Registrar compra — já lança no caixa.">
            <MoneyInput id="mv-custo" value={custo} onChange={setCusto} />
          </Field>
        ) : null}
        <Field label="Data" htmlFor="mv-data">
          <input id="mv-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Observação" htmlFor="mv-obs">
          <input id="mv-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder={tipo === 'saida' ? 'Ex.: troca de agulha da máquina reta' : ''} />
        </Field>
        <button className="btn btn-primary btn-full" type="submit">
          Salvar
        </button>
      </form>
    </Modal>
  )
}
