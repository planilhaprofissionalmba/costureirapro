import { type FormEvent, useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { EmptyState, ErrorState, Field, ListaOpcoes, Loading, Modal, MoneyInput, PageHeader } from '../components/ui'
import { SyncedTable } from '../components/SyncedTable'
import { useAuth } from '../lib/auth'
import { apagar, atualizar, inserir } from '../lib/db'
import { useLista } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { TIPOS_PECA, TIPOS_SERVICO } from '../lib/costura'
import { compararNome, mascaraMoeda, moeda, parseMoeda } from '../lib/format'
import { exportCsv } from '../lib/export'
import type { Servico } from '../lib/types'

type FormServ = { id?: string; nome: string; tipo: string; peca: string; preco: string; prazo: string; ativo: boolean }

/** Sugestões para começar (a costureira escolhe se quer usar). */
const SUGESTOES: Omit<FormServ, 'id' | 'ativo'>[] = [
  { nome: 'Barra de calça', tipo: 'Barra', peca: 'Calça', preco: '20,00', prazo: '3' },
  { nome: 'Barra de calça jeans (original)', tipo: 'Barra', peca: 'Calça jeans', preco: '30,00', prazo: '3' },
  { nome: 'Ajuste de cintura', tipo: 'Ajuste', peca: 'Calça', preco: '35,00', prazo: '5' },
  { nome: 'Troca de zíper', tipo: 'Troca de zíper', peca: 'Calça jeans', preco: '30,00', prazo: '3' },
  { nome: 'Ajuste de vestido', tipo: 'Ajuste', peca: 'Vestido', preco: '60,00', prazo: '7' },
  { nome: 'Encurtar manga', tipo: 'Ajuste', peca: 'Camisa', preco: '30,00', prazo: '5' },
  { nome: 'Pregar botão', tipo: 'Pregar botão', peca: 'Camisa', preco: '5,00', prazo: '1' },
]

export function ServicosPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const { rows, loading, error, reload } = useLista<Servico>('servicos', 'order=nome.asc')
  const [form, setForm] = useState<FormServ | null>(null)
  const lista = useMemo(() => [...rows].sort((a, b) => compararNome(a.nome, b.nome)), [rows])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user || !form) return
    if (!form.nome.trim()) return push('warn', 'Informe o nome do serviço.')
    const linha = {
      nome: form.nome.trim(),
      tipo_servico: form.tipo.trim() || 'Ajuste',
      tipo_peca: form.peca.trim() || null,
      preco: parseMoeda(form.preco),
      prazo_dias: Math.max(0, Number(form.prazo) || 0),
      ativo: form.ativo,
    }
    const r = form.id ? await atualizar('servicos', form.id, linha) : await inserir('servicos', { ...linha, account_id: user.accountId })
    if (r.error) return push('error', r.error)
    push('ok', 'Serviço salvo.')
    setForm(null)
    void reload()
  }

  async function usarSugestoes() {
    if (!user) return
    const r = await inserir(
      'servicos',
      SUGESTOES.map((s) => ({ account_id: user.accountId, nome: s.nome, tipo_servico: s.tipo, tipo_peca: s.peca, preco: parseMoeda(s.preco), prazo_dias: Number(s.prazo) })),
    )
    if (r.error) return push('error', r.error)
    push('ok', 'Tabela de exemplo criada. Ajuste os preços ao seu ateliê.')
    void reload()
  }

  async function excluir(s: Servico) {
    if (!window.confirm(`Excluir "${s.nome}" da tabela?`)) return
    const r = await apagar('servicos', s.id)
    if (r.error) return push('error', r.error)
    void reload()
  }

  return (
    <div className="page">
      <PageHeader
        title="Tabela de preços"
        sub="Seus serviços e preços. Ao receber uma costura, escolha daqui e o valor já entra."
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => setForm({ nome: '', tipo: 'Ajuste', peca: '', preco: '', prazo: '7', ativo: true })}>
              <Plus size={18} /> Novo serviço
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!lista.length}
              onClick={() => exportCsv('tabela-precos', ['Serviço', 'Tipo', 'Peça', 'Preço', 'Prazo (dias)'], lista.map((s) => [s.nome, s.tipo_servico, s.tipo_peca, Number(s.preco).toFixed(2).replace('.', ','), s.prazo_dias]))}
            >
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState texto={error} onRetry={reload} />
      ) : !lista.length ? (
        <EmptyState
          texto="Nenhum serviço na tabela ainda."
          acao={
            <button className="btn btn-secondary" type="button" onClick={() => void usarSugestoes()}>
              Começar com uma tabela de exemplo
            </button>
          }
        />
      ) : (
        <SyncedTable className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Tipo</th>
                <th>Preço</th>
                <th>Prazo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="cell-main">
                      <strong>
                        {s.nome} {!s.ativo ? <span className="badge badge--apagado">Inativo</span> : null}
                      </strong>
                      {s.tipo_peca ? <small>{s.tipo_peca}</small> : null}
                    </div>
                  </td>
                  <td>{s.tipo_servico}</td>
                  <td>{moeda(s.preco)}</td>
                  <td>{s.prazo_dias} dia(s)</td>
                  <td>
                    <div className="acoes-linha">
                      <button
                        className="icon-btn icon-btn--claro"
                        type="button"
                        aria-label="Editar"
                        onClick={() => setForm({ id: s.id, nome: s.nome, tipo: s.tipo_servico, peca: s.tipo_peca || '', preco: mascaraMoeda(Number(s.preco).toFixed(2)), prazo: String(s.prazo_dias), ativo: s.ativo })}
                      >
                        <Pencil size={18} />
                      </button>
                      <button className="icon-btn icon-btn--claro" type="button" aria-label="Excluir" onClick={() => void excluir(s)}>
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
      {form ? (
        <Modal titulo={form.id ? 'Editar serviço' : 'Novo serviço'} onClose={() => setForm(null)}>
          <form className="form-grid" onSubmit={salvar}>
            <div className="field span-all">
              <label className="field-label" htmlFor="s-nome">
                Nome do serviço *
              </label>
              <input id="s-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Barra de calça" />
            </div>
            <Field label="Tipo de serviço" htmlFor="s-tipo">
              <input id="s-tipo" list="lista-tipo-serv" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} />
            </Field>
            <Field label="Peça" htmlFor="s-peca">
              <input id="s-peca" list="lista-peca-serv" value={form.peca} onChange={(e) => setForm({ ...form, peca: e.target.value })} />
            </Field>
            <Field label="Preço" htmlFor="s-preco">
              <MoneyInput id="s-preco" value={form.preco} onChange={(v) => setForm({ ...form, preco: v })} />
            </Field>
            <Field label="Prazo (dias)" htmlFor="s-prazo">
              <input id="s-prazo" inputMode="numeric" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
            </Field>
            {form.id ? (
              <label className="checkbox field">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                <span>Serviço ativo</span>
              </label>
            ) : null}
            <button className="btn btn-primary span-all" type="submit">
              Salvar serviço
            </button>
          </form>
          <ListaOpcoes id="lista-tipo-serv" opcoes={TIPOS_SERVICO} />
          <ListaOpcoes id="lista-peca-serv" opcoes={TIPOS_PECA} />
        </Modal>
      ) : null}
    </div>
  )
}
