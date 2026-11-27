import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Scissors, Shirt, Trash2, Wallet } from 'lucide-react'
import { ErrorState, Field, Loading, Modal, PageHeader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { apagar, atualizar, inserir } from '../lib/db'
import { useLista } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { ordemAberta, rotuloStatus, TIPOS_COMPROMISSO } from '../lib/costura'
import { compararNome, formatDiaSemana, formatHora, hojeISO, isoLocal, moeda } from '../lib/format'
import type { Cliente, Compromisso, Lancamento, OrdemResumo } from '../lib/types'

type Evento = {
  chave: string
  data: string
  hora: string
  titulo: string
  detalhe: string
  tipo: 'entrega' | 'prova' | 'compromisso' | 'receber' | 'pagar'
  feito: boolean
  link?: string
  compromisso?: Compromisso
}

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type FormComp = { id?: string; titulo: string; tipo: string; data: string; hora: string; horaFim: string; local: string; cliente: string; obs: string }

export function AgendaPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const hoje = hojeISO()
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [dia, setDia] = useState(hoje)
  const [form, setForm] = useState<FormComp | null>(null)

  const inicio = isoLocal(new Date(mes.getFullYear(), mes.getMonth(), 1))
  const fim = isoLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
  const comp = useLista<Compromisso>('compromissos', `data_compromisso=gte.${inicio}&data_compromisso=lte.${fim}&order=data_compromisso.asc,hora_inicio.asc`)
  const ordens = useLista<OrdemResumo>('ordens_resumo', `or=(and(data_entrega.gte.${inicio},data_entrega.lte.${fim}),and(data_prova.gte.${inicio},data_prova.lte.${fim}))`)
  const lanc = useLista<Lancamento>('lancamentos', `status=eq.pendente&data_vencimento=gte.${inicio}&data_vencimento=lte.${fim}`)
  const clientes = useLista<Cliente>('clientes', 'select=id,nome_completo&order=nome_completo.asc')

  const eventos = useMemo(() => {
    const lista: Evento[] = []
    for (const c of comp.rows) {
      lista.push({
        chave: `c-${c.id}`,
        data: c.data_compromisso,
        hora: formatHora(c.hora_inicio),
        titulo: c.titulo,
        detalhe: [c.tipo, c.local].filter(Boolean).join(' · '),
        tipo: 'compromisso',
        feito: c.concluido,
        compromisso: c,
      })
    }
    for (const o of ordens.rows) {
      if (o.status === 'cancelada') continue
      if (o.data_entrega >= inicio && o.data_entrega <= fim) {
        lista.push({
          chave: `e-${o.id}`,
          data: o.data_entrega,
          hora: formatHora(o.hora_entrega),
          titulo: `Entregar: ${o.cliente_nome}`,
          detalhe: `Nº ${o.numero} · ${o.resumo_pecas || ''} · ${rotuloStatus(o.status)}`,
          tipo: 'entrega',
          feito: !ordemAberta(o.status),
          link: `/app/costuras/${o.id}`,
        })
      }
      if (o.data_prova && o.data_prova >= inicio && o.data_prova <= fim) {
        lista.push({
          chave: `p-${o.id}`,
          data: o.data_prova,
          hora: '',
          titulo: `Prova: ${o.cliente_nome}`,
          detalhe: `Nº ${o.numero} · ${o.resumo_pecas || ''}`,
          tipo: 'prova',
          feito: !ordemAberta(o.status),
          link: `/app/costuras/${o.id}`,
        })
      }
    }
    for (const l of lanc.rows) {
      lista.push({
        chave: `l-${l.id}`,
        data: l.data_vencimento!,
        hora: '',
        titulo: `${l.tipo === 'entrada' ? 'Receber' : 'Pagar'}: ${moeda(l.valor)}`,
        detalhe: l.descricao,
        tipo: l.tipo === 'entrada' ? 'receber' : 'pagar',
        feito: false,
        link: '/app/pendencias',
      })
    }
    return lista.sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99') || compararNome(a.titulo, b.titulo))
  }, [comp.rows, ordens.rows, lanc.rows, inicio, fim])

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>()
    eventos.forEach((e) => m.set(e.data, [...(m.get(e.data) || []), e]))
    return m
  }, [eventos])

  const celulas = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    const out: (string | null)[] = Array(primeiro.getDay()).fill(null)
    for (let d = 1; d <= total; d++) out.push(isoLocal(new Date(mes.getFullYear(), mes.getMonth(), d)))
    while (out.length % 7) out.push(null)
    return out
  }, [mes])

  function mudarMes(delta: number) {
    const novo = new Date(mes.getFullYear(), mes.getMonth() + delta, 1)
    setMes(novo)
    setDia(delta === 0 ? hoje : isoLocal(novo))
  }

  function novo(data = dia) {
    setForm({ titulo: '', tipo: 'Compromisso', data, hora: '', horaFim: '', local: '', cliente: '', obs: '' })
  }

  function editar(c: Compromisso) {
    setForm({
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      data: c.data_compromisso,
      hora: formatHora(c.hora_inicio),
      horaFim: formatHora(c.hora_fim),
      local: c.local || '',
      cliente: c.cliente_id || '',
      obs: c.observacoes || '',
    })
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user || !form) return
    if (!form.titulo.trim()) return push('warn', 'Escreva o que é o compromisso.')
    const linha = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      data_compromisso: form.data,
      hora_inicio: form.hora || null,
      hora_fim: form.horaFim || null,
      local: form.local.trim() || null,
      cliente_id: form.cliente || null,
      observacoes: form.obs.trim() || null,
    }
    const r = form.id ? await atualizar('compromissos', form.id, linha) : await inserir('compromissos', { ...linha, account_id: user.accountId })
    if (r.error) return push('error', r.error)
    push('ok', 'Compromisso salvo na agenda.')
    setDia(form.data)
    setForm(null)
    void comp.reload()
  }

  async function alternarFeito(c: Compromisso) {
    const r = await atualizar('compromissos', c.id, { concluido: !c.concluido })
    if (r.error) return push('error', r.error)
    void comp.reload()
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir este compromisso?')) return
    const r = await apagar('compromissos', id)
    if (r.error) return push('error', r.error)
    setForm(null)
    void comp.reload()
  }

  const doDia = porDia.get(dia) || []
  const carregando = comp.loading || ordens.loading
  const erro = comp.error || ordens.error

  const icone = (t: Evento['tipo']) =>
    t === 'entrega' ? <Shirt size={16} /> : t === 'prova' ? <Scissors size={16} /> : t === 'compromisso' ? <CalendarPlus size={16} /> : <Wallet size={16} />

  return (
    <div className="page">
      <PageHeader
        title="Agenda"
        sub="Entregas, provas, pagamentos e seus compromissos num lugar só. Toque num dia para ver tudo dele."
        actions={
          <button className="btn btn-primary" type="button" onClick={() => novo()}>
            <CalendarPlus size={18} /> Novo compromisso
          </button>
        }
      />
      {erro ? <ErrorState texto={erro} onRetry={() => void comp.reload()} /> : null}
      <div className="agenda">
        <section className="card agenda-mes">
          <div className="agenda-nav">
            <button className="icon-btn icon-btn--claro" type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
              <ChevronLeft size={22} />
            </button>
            <div className="agenda-selects">
              <select
                aria-label="Mês"
                value={mes.getMonth()}
                onChange={(e) => {
                  const novo = new Date(mes.getFullYear(), Number(e.target.value), 1)
                  setMes(novo)
                  setDia(isoLocal(novo))
                }}
              >
                {NOMES_MES.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                aria-label="Ano"
                value={mes.getFullYear()}
                onChange={(e) => {
                  const novo = new Date(Number(e.target.value), mes.getMonth(), 1)
                  setMes(novo)
                  setDia(isoLocal(novo))
                }}
              >
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <button className="icon-btn icon-btn--claro" type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
              <ChevronRight size={22} />
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
            const d = new Date()
            setMes(new Date(d.getFullYear(), d.getMonth(), 1))
            setDia(hoje)
          }}>
            Hoje
          </button>
          <div className="cal-grid" role="grid">
            {DIAS.map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
            {celulas.map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  className={`cal-dia ${iso === dia ? 'cal-dia--sel' : ''} ${iso === hoje ? 'cal-dia--hoje' : ''}`}
                  onClick={() => setDia(iso)}
                  aria-label={`${formatDiaSemana(iso)}: ${(porDia.get(iso) || []).length} item(ns)`}
                >
                  <span>{Number(iso.slice(8))}</span>
                  {(porDia.get(iso) || []).length ? (
                    <span className="cal-pontos">
                      {[...new Set((porDia.get(iso) || []).map((e) => e.tipo))].slice(0, 3).map((t) => (
                        <i key={t} className={`ponto ponto--${t}`} />
                      ))}
                    </span>
                  ) : null}
                </button>
              ) : (
                <div key={`v${i}`} className="cal-vazio" />
              ),
            )}
          </div>
          <div className="legenda">
            <span><i className="ponto ponto--entrega" /> Entrega</span>
            <span><i className="ponto ponto--prova" /> Prova</span>
            <span><i className="ponto ponto--compromisso" /> Compromisso</span>
            <span><i className="ponto ponto--receber" /> Receber</span>
            <span><i className="ponto ponto--pagar" /> Pagar</span>
          </div>
        </section>

        <section className="card agenda-dia">
          <div className="card-head">
            <h2 className="section-title">{formatDiaSemana(dia)}</h2>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => novo(dia)}>
              <CalendarPlus size={16} /> Anotar neste dia
            </button>
          </div>
          {carregando ? (
            <Loading />
          ) : doDia.length ? (
            <ul className="eventos">
              {doDia.map((ev) => (
                <li key={ev.chave} className={`evento evento--${ev.tipo} ${ev.feito ? 'evento--feito' : ''}`}>
                  <span className="evento-ic">{icone(ev.tipo)}</span>
                  <div className="evento-txt">
                    <strong>
                      {ev.hora ? `${ev.hora} · ` : ''}
                      {ev.titulo}
                    </strong>
                    {ev.detalhe ? <small>{ev.detalhe}</small> : null}
                  </div>
                  {ev.compromisso ? (
                    <div className="evento-acoes">
                      <button className="icon-btn icon-btn--claro" type="button" aria-label={ev.feito ? 'Marcar como não feito' : 'Marcar como feito'} onClick={() => void alternarFeito(ev.compromisso!)}>
                        <Check size={18} />
                      </button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => editar(ev.compromisso!)}>
                        Editar
                      </button>
                    </div>
                  ) : ev.link ? (
                    <Link className="btn btn-ghost btn-sm" to={ev.link}>
                      Abrir
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="page-sub">Nada marcado neste dia.</p>
          )}
        </section>
      </div>

      {form ? (
        <Modal titulo={form.id ? 'Editar compromisso' : 'Novo compromisso'} onClose={() => setForm(null)}>
          <form className="stack" onSubmit={salvar}>
            <Field label="O que é *" htmlFor="ag-tit">
              <input id="ag-tit" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Buscar tecido na loja" />
            </Field>
            <Field label="Tipo" htmlFor="ag-tipo">
              <select id="ag-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_COMPROMISSO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Dia" htmlFor="ag-data">
                <input id="ag-data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </Field>
              <Field label="Começa" htmlFor="ag-hora">
                <input id="ag-hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
              </Field>
              <Field label="Termina" htmlFor="ag-fim">
                <input id="ag-fim" type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} />
              </Field>
            </div>
            <Field label="Cliente (se tiver)" htmlFor="ag-cli">
              <select id="ag-cli" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })}>
                <option value="">Nenhuma</option>
                {clientes.rows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_completo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Local" htmlFor="ag-local">
              <input id="ag-local" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </Field>
            <Field label="Observações" htmlFor="ag-obs">
              <textarea id="ag-obs" rows={2} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
            </Field>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit">
                Salvar na agenda
              </button>
              {form.id ? (
                <button className="btn btn-danger" type="button" onClick={() => void excluir(form.id!)}>
                  <Trash2 size={16} /> Excluir
                </button>
              ) : null}
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
