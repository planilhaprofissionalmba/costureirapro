import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  HandCoins,
  MessageCircle,
  Package,
  Plus,
  Printer,
  Save,
  Scissors,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { ErrorState, Field, ListaOpcoes, Loading, Modal, MoneyInput, PageHeader, StatusBadge } from '../components/ui'
import { WhatsAppDialog } from '../components/WhatsAppDialog'
import { useAuth } from '../lib/auth'
import { apagar, atualizar, buscar, inserir, listar } from '../lib/db'
import { useLista, usePreferencias } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { FORMAS_PAGAMENTO, STATUS_ORDEM, TIPOS_PECA, TIPOS_SERVICO, type TipoMensagem } from '../lib/costura'
import { compararNome, formatDateBR, hojeISO, mascaraMoeda, moeda, numeroBR, parseMoeda, somarDias } from '../lib/format'
import type { Cliente, Lancamento, Movimento, Ordem, OrdemItem, OrdemResumo, Produto, Servico, StatusOrdem } from '../lib/types'

type ItemForm = {
  id?: string
  tipo_peca: string
  tipo_servico: string
  descricao: string
  cor: string
  quantidade: string
  valor: string
  concluido: boolean
}

const ITEM_VAZIO: ItemForm = { tipo_peca: '', tipo_servico: 'Ajuste', descricao: '', cor: '', quantidade: '1', valor: '', concluido: false }

export function CosturaFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const editando = Boolean(id)
  const { user } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const { prefs } = usePreferencias()
  const clientes = useLista<Cliente>('clientes', 'select=id,nome_completo,telefone&ativo=eq.true&order=nome_completo.asc')
  const servicos = useLista<Servico>('servicos', 'ativo=eq.true&order=nome.asc')

  const prazo = prefs?.prazo_padrao_dias ?? 7
  const [clienteId, setClienteId] = useState(params.get('cliente') || '')
  const [recebimento, setRecebimento] = useState(hojeISO())
  const [entrega, setEntrega] = useState(somarDias(hojeISO(), 7))
  const [entregaTocada, setEntregaTocada] = useState(false)
  const [horaEntrega, setHoraEntrega] = useState('')
  const [prova, setProva] = useState('')
  const [status, setStatus] = useState<StatusOrdem>('recebida')
  const [urgente, setUrgente] = useState(false)
  const [desconto, setDesconto] = useState('')
  const [obs, setObs] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }])
  const [itensOriginais, setItensOriginais] = useState<string[]>([])
  const [sinal, setSinal] = useState('')
  const [formaSinal, setFormaSinal] = useState('Pix')
  const [loading, setLoading] = useState(editando)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resumo, setResumo] = useState<OrdemResumo | null>(null)
  const [whats, setWhats] = useState<TipoMensagem | null>(null)

  useEffect(() => {
    if (!editando && !entregaTocada) setEntrega(somarDias(recebimento, prazo))
  }, [prazo, recebimento, editando, entregaTocada])

  async function carregarResumo(ordemId: string) {
    const r = await buscar<OrdemResumo>('ordens_resumo', ordemId)
    if (r.data) setResumo(r.data)
  }

  useEffect(() => {
    if (!id) return
    let vivo = true
    void (async () => {
      const [o, its] = await Promise.all([
        buscar<Ordem>('ordens', id),
        listar<OrdemItem>('ordem_itens', `ordem_id=eq.${id}&order=created_at.asc`),
      ])
      if (!vivo) return
      setLoading(false)
      if (o.error || !o.data) {
        setErroCarga(o.error || 'Costura não encontrada.')
        return
      }
      const d = o.data
      setClienteId(d.cliente_id)
      setRecebimento(d.data_recebimento)
      setEntrega(d.data_entrega)
      setHoraEntrega(d.hora_entrega?.slice(0, 5) || '')
      setProva(d.data_prova || '')
      setStatus(d.status)
      setUrgente(d.urgente)
      setDesconto(Number(d.desconto) ? mascaraMoeda(Number(d.desconto).toFixed(2)) : '')
      setObs(d.observacoes || '')
      const lista = (its.data || []).map((i) => ({
        id: i.id,
        tipo_peca: i.tipo_peca,
        tipo_servico: i.tipo_servico,
        descricao: i.descricao || '',
        cor: i.cor || '',
        quantidade: String(i.quantidade),
        valor: mascaraMoeda(Number(i.valor_unitario).toFixed(2)),
        concluido: i.concluido,
      }))
      setItens(lista.length ? lista : [{ ...ITEM_VAZIO }])
      setItensOriginais(lista.map((i) => i.id!))
      void carregarResumo(id)
    })()
    return () => {
      vivo = false
    }
  }, [id])

  const total = useMemo(
    () => itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * parseMoeda(i.valor), 0),
    [itens],
  )
  const totalFinal = Math.max(total - parseMoeda(desconto), 0)
  const clientesOrdenados = useMemo(() => [...clientes.rows].sort((a, b) => compararNome(a.nome_completo, b.nome_completo)), [clientes.rows])
  const clienteSel = clientes.rows.find((c) => c.id === clienteId)

  function setItem(idx: number, patch: Partial<ItemForm>) {
    setItens((lista) => lista.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function usarServico(idx: number, servicoId: string) {
    const s = servicos.rows.find((x) => x.id === servicoId)
    if (!s) return
    setItem(idx, {
      tipo_servico: s.tipo_servico,
      tipo_peca: s.tipo_peca || itens[idx].tipo_peca,
      descricao: itens[idx].descricao || s.nome,
      valor: mascaraMoeda(Number(s.preco).toFixed(2)),
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setErro(null)
    if (!clienteId) return setErro('Escolha a cliente (ou cadastre uma nova).')
    if (!entrega) return setErro('Informe a data de entrega.')
    const validos = itens.filter((i) => i.tipo_peca.trim())
    if (!validos.length) return setErro('Informe pelo menos uma peça.')
    if (validos.some((i) => !(Number(i.quantidade) > 0))) return setErro('A quantidade de cada peça precisa ser 1 ou mais.')

    setBusy(true)
    const cabecalho = {
      cliente_id: clienteId,
      data_recebimento: recebimento,
      data_entrega: entrega,
      hora_entrega: horaEntrega || null,
      data_prova: prova || null,
      status,
      urgente,
      desconto: parseMoeda(desconto),
      observacoes: obs.trim() || null,
      data_entregue: status === 'entregue' ? resumo?.data_entregue || hojeISO() : null,
    }
    let ordemId = id
    if (id) {
      const r = await atualizar<Ordem>('ordens', id, cabecalho)
      if (r.error) {
        setBusy(false)
        return setErro(r.error)
      }
    } else {
      const r = await inserir<Ordem>('ordens', { ...cabecalho, account_id: user.accountId, numero: 0 })
      if (r.error || !r.data?.[0]) {
        setBusy(false)
        return setErro(r.error || 'Não foi possível salvar a costura.')
      }
      ordemId = r.data[0].id
    }

    // Peças: atualiza as que existem, cria as novas, remove as tiradas.
    const linhaItem = (i: ItemForm) => ({
      tipo_peca: i.tipo_peca.trim(),
      tipo_servico: i.tipo_servico.trim() || 'Ajuste',
      descricao: i.descricao.trim() || null,
      cor: i.cor.trim() || null,
      quantidade: Math.max(1, Math.round(Number(i.quantidade) || 1)),
      valor_unitario: parseMoeda(i.valor),
      concluido: i.concluido,
    })
    const erros: string[] = []
    for (const it of validos.filter((x) => x.id)) {
      const r = await atualizar('ordem_itens', it.id!, linhaItem(it))
      if (r.error) erros.push(r.error)
    }
    const novos = validos.filter((x) => !x.id).map((x) => ({ ...linhaItem(x), account_id: user.accountId, ordem_id: ordemId }))
    if (novos.length) {
      const r = await inserir('ordem_itens', novos)
      if (r.error) erros.push(r.error)
    }
    const manter = new Set(validos.map((x) => x.id).filter(Boolean))
    for (const antigo of itensOriginais.filter((x) => !manter.has(x))) {
      const r = await apagar('ordem_itens', antigo)
      if (r.error) erros.push(r.error)
    }

    // Sinal (adiantamento) na entrada da costura → entra no caixa.
    if (!id && parseMoeda(sinal) > 0) {
      const r = await inserir('lancamentos', {
        account_id: user.accountId,
        tipo: 'entrada',
        status: 'pago',
        categoria: 'Sinal (adiantamento)',
        descricao: `Sinal da costura - ${clienteSel?.nome_completo || 'cliente'}`,
        valor: parseMoeda(sinal),
        data_lancamento: hojeISO(),
        forma_pagamento: formaSinal,
        cliente_id: clienteId,
        ordem_id: ordemId,
      })
      if (r.error) erros.push(r.error)
    }
    setBusy(false)
    if (erros.length) {
      push('warn', `Costura salva, mas algo não foi gravado: ${erros[0]}`)
      if (ordemId && !id) navigate(`/app/costuras/${ordemId}`)
      return
    }
    push('ok', id ? 'Costura atualizada.' : 'Costura registrada.')
    navigate('/app/dashboard')
  }

  async function mudarStatus(novo: StatusOrdem) {
    if (!id) return
    const r = await atualizar('ordens', id, { status: novo, data_entregue: novo === 'entregue' ? hojeISO() : null })
    if (r.error) return push('error', r.error)
    setStatus(novo)
    push('ok', `Status: ${STATUS_ORDEM.find((s) => s.value === novo)?.label}.`)
    void carregarResumo(id)
    if (novo === 'pronta' && resumo?.cliente_telefone) setWhats('pronta')
  }

  async function onExcluir() {
    if (!id || !window.confirm('Excluir esta costura e as peças dela? Os pagamentos ficam no caixa, sem ligação.')) return
    const r = await apagar('ordens', id)
    if (r.error) return push('error', r.error)
    push('ok', 'Costura excluída.')
    navigate('/app/costuras')
  }

  if (loading) return <Loading />
  if (erroCarga) return <ErrorState texto={erroCarga} />

  return (
    <div className="page">
      <PageHeader
        title={editando ? `Costura nº ${resumo?.numero ?? ''}` : 'Receber costura'}
        sub={
          editando
            ? `${resumo?.cliente_nome || ''} · recebida em ${formatDateBR(recebimento)}`
            : 'Anote a cliente, as peças, o que vai modificar e a data de entrega.'
        }
        actions={
          editando && resumo ? (
            <>
              <StatusBadge status={status} />
              <button className="btn btn-whats" type="button" onClick={() => setWhats(status === 'pronta' ? 'pronta' : 'lembrete')}>
                <MessageCircle size={18} /> WhatsApp
              </button>
              <Link className="btn btn-ghost" to={`/app/costuras/${id}/recibo`}>
                <Printer size={16} /> Recibo
              </Link>
            </>
          ) : null
        }
      />

      {editando ? (
        <div className="status-steps" role="group" aria-label="Mudar status rapidamente">
          {STATUS_ORDEM.filter((s) => s.value !== 'cancelada').map((s) => (
            <button
              key={s.value}
              type="button"
              className={`step ${status === s.value ? 'step--ativo' : ''}`}
              onClick={() => void mudarStatus(s.value)}
            >
              {status === s.value ? <CheckCircle2 size={16} /> : null} {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <form className="stack" onSubmit={onSubmit} noValidate>
        {erro ? <div className="alert alert-error">{erro}</div> : null}

        <section className="card form-grid">
          <h2 className="section-title span-all">1. Cliente e datas</h2>
          <div className="field span-2">
            <label className="field-label" htmlFor="o-cliente">
              Cliente *
            </label>
            <div className="input-acao">
              <select id="o-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
                <option value="">Escolha a cliente…</option>
                {clientesOrdenados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_completo}
                  </option>
                ))}
              </select>
              <Link className="btn btn-ghost" to="/app/clientes/nova" title="Cadastrar nova cliente">
                <UserPlus size={18} /> Nova
              </Link>
            </div>
          </div>
          <Field label="Recebida em" htmlFor="o-rec">
            <input id="o-rec" type="date" value={recebimento} onChange={(e) => setRecebimento(e.target.value)} />
          </Field>
          <Field label="Entregar em *" htmlFor="o-ent" dica={`Prazo padrão: ${prazo} dias (muda em Configurações).`}>
            <input
              id="o-ent"
              type="date"
              value={entrega}
              required
              onChange={(e) => {
                setEntregaTocada(true)
                setEntrega(e.target.value)
              }}
            />
          </Field>
          <Field label="Hora da entrega" htmlFor="o-hora">
            <input id="o-hora" type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
          </Field>
          <Field label="Prova de roupa (se tiver)" htmlFor="o-prova">
            <input id="o-prova" type="date" value={prova} onChange={(e) => setProva(e.target.value)} />
          </Field>
          <Field label="Situação" htmlFor="o-status">
            <select id="o-status" value={status} onChange={(e) => setStatus(e.target.value as StatusOrdem)}>
              {STATUS_ORDEM.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="checkbox field">
            <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            <span>É urgente</span>
          </label>
        </section>

        <section className="card">
          <h2 className="section-title">2. Peças e o que modificar</h2>
          <p className="page-sub">Uma linha para cada tipo de peça. Use a tabela de preços para preencher mais rápido.</p>
          <div className="itens">
            {itens.map((it, idx) => (
              <div key={it.id || idx} className="item-card">
                <div className="item-head">
                  <strong>Peça {idx + 1}</strong>
                  {editando ? (
                    <label className="checkbox">
                      <input type="checkbox" checked={it.concluido} onChange={(e) => setItem(idx, { concluido: e.target.checked })} />
                      <span>Pronta</span>
                    </label>
                  ) : null}
                  {itens.length > 1 ? (
                    <button
                      className="icon-btn icon-btn--claro"
                      type="button"
                      aria-label={`Tirar peça ${idx + 1}`}
                      onClick={() => setItens((l) => l.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : null}
                </div>
                <div className="form-grid">
                  {servicos.rows.length ? (
                    <Field label="Usar preço da tabela" htmlFor={`i-serv-${idx}`}>
                      <select id={`i-serv-${idx}`} value="" onChange={(e) => usarServico(idx, e.target.value)}>
                        <option value="">Escolher serviço…</option>
                        {servicos.rows.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome} — {moeda(s.preco)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <Field label="Peça *" htmlFor={`i-peca-${idx}`}>
                    <input
                      id={`i-peca-${idx}`}
                      list="lista-pecas"
                      value={it.tipo_peca}
                      onChange={(e) => setItem(idx, { tipo_peca: e.target.value })}
                      placeholder="Ex.: Calça jeans"
                    />
                  </Field>
                  <Field label="Serviço" htmlFor={`i-serv2-${idx}`}>
                    <input
                      id={`i-serv2-${idx}`}
                      list="lista-servicos"
                      value={it.tipo_servico}
                      onChange={(e) => setItem(idx, { tipo_servico: e.target.value })}
                      placeholder="Ex.: Barra"
                    />
                  </Field>
                  <Field label="Cor / detalhe" htmlFor={`i-cor-${idx}`}>
                    <input id={`i-cor-${idx}`} value={it.cor} onChange={(e) => setItem(idx, { cor: e.target.value })} placeholder="Ex.: azul" />
                  </Field>
                  <Field label="Quantidade" htmlFor={`i-qtd-${idx}`}>
                    <input
                      id={`i-qtd-${idx}`}
                      inputMode="numeric"
                      value={it.quantidade}
                      onChange={(e) => setItem(idx, { quantidade: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                    />
                  </Field>
                  <Field label="Valor de cada uma" htmlFor={`i-val-${idx}`}>
                    <MoneyInput id={`i-val-${idx}`} value={it.valor} onChange={(v) => setItem(idx, { valor: v })} />
                  </Field>
                  <div className="field span-all">
                    <label className="field-label" htmlFor={`i-desc-${idx}`}>
                      O que modificar
                    </label>
                    <textarea
                      id={`i-desc-${idx}`}
                      rows={2}
                      value={it.descricao}
                      onChange={(e) => setItem(idx, { descricao: e.target.value })}
                      placeholder="Ex.: subir a barra 3 cm e apertar a cintura 2 cm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => setItens((l) => [...l, { ...ITEM_VAZIO }])}>
            <Plus size={18} /> Adicionar outra peça
          </button>
        </section>

        <section className="card form-grid">
          <h2 className="section-title span-all">3. Valores</h2>
          <div className="totais span-all">
            <div>
              <span>Total das peças</span>
              <strong>{moeda(total)}</strong>
            </div>
            <div>
              <span>Total com desconto</span>
              <strong>{moeda(totalFinal)}</strong>
            </div>
            {resumo ? (
              <>
                <div>
                  <span>Já pago</span>
                  <strong className="txt-ok">{moeda(resumo.valor_pago)}</strong>
                </div>
                <div>
                  <span>Falta pagar</span>
                  <strong className={Number(resumo.saldo) > 0 ? 'txt-erro' : 'txt-ok'}>{moeda(resumo.saldo)}</strong>
                </div>
              </>
            ) : null}
          </div>
          <Field label="Desconto" htmlFor="o-desc">
            <MoneyInput id="o-desc" value={desconto} onChange={setDesconto} />
          </Field>
          {!editando ? (
            <>
              <Field label="Sinal recebido agora" htmlFor="o-sinal" dica="Se a cliente já pagou uma parte.">
                <MoneyInput id="o-sinal" value={sinal} onChange={setSinal} />
              </Field>
              <Field label="Forma do sinal" htmlFor="o-forma">
                <select id="o-forma" value={formaSinal} onChange={(e) => setFormaSinal(e.target.value)}>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}
          <div className="field span-all">
            <label className="field-label" htmlFor="o-obs">
              Observações
            </label>
            <textarea id="o-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: cliente traz o zíper" />
          </div>
        </section>

        <div className="btn-row sticky-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Save size={18} /> {busy ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar costura'}
          </button>
          {editando ? (
            <button className="btn btn-danger" type="button" onClick={onExcluir}>
              <Trash2 size={16} /> Excluir
            </button>
          ) : null}
        </div>
      </form>

      {editando && id && resumo ? (
        <>
          <PagamentosOrdem ordem={resumo} onChange={() => void carregarResumo(id)} />
          <MaterialUsado ordemId={id} />
        </>
      ) : null}

      {whats && resumo ? (
        <WhatsAppDialog alvo={resumo} prefs={prefs} tipoInicial={whats} onClose={() => setWhats(null)} />
      ) : null}
      <ListaOpcoes id="lista-pecas" opcoes={TIPOS_PECA} />
      <ListaOpcoes id="lista-servicos" opcoes={TIPOS_SERVICO} />
    </div>
  )
}

function PagamentosOrdem({ ordem, onChange }: { ordem: OrdemResumo; onChange: () => void }) {
  const { user } = useAuth()
  const { push } = useToast()
  const lista = useLista<Lancamento>('lancamentos', `ordem_id=eq.${ordem.id}&tipo=eq.entrada&order=data_lancamento.asc`)
  const [modal, setModal] = useState<'pagar' | 'agendar' | null>(null)
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('Pix')
  const [data, setData] = useState(hojeISO())

  function abrir(tipo: 'pagar' | 'agendar') {
    setValor(Number(ordem.saldo) > 0 ? mascaraMoeda(Number(ordem.saldo).toFixed(2)) : '')
    setData(tipo === 'pagar' ? hojeISO() : ordem.data_entrega)
    setModal(tipo)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user || !modal) return
    const v = parseMoeda(valor)
    if (!(v > 0)) return push('warn', 'Informe o valor.')
    const pago = modal === 'pagar'
    const r = await inserir('lancamentos', {
      account_id: user.accountId,
      tipo: 'entrada',
      status: pago ? 'pago' : 'pendente',
      categoria: 'Costura / serviço',
      descricao: `Costura nº ${ordem.numero} - ${ordem.cliente_nome}`,
      valor: v,
      data_lancamento: data,
      data_vencimento: pago ? null : data,
      forma_pagamento: forma,
      cliente_id: ordem.cliente_id,
      ordem_id: ordem.id,
    })
    if (r.error) return push('error', r.error)
    push('ok', pago ? 'Pagamento registrado no caixa.' : 'Recebimento agendado.')
    setModal(null)
    void lista.reload()
    onChange()
  }

  async function marcarPago(l: Lancamento) {
    const r = await atualizar('lancamentos', l.id, { status: 'pago', data_lancamento: hojeISO() })
    if (r.error) return push('error', r.error)
    push('ok', 'Recebido!')
    void lista.reload()
    onChange()
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="section-title">
          <HandCoins size={18} /> Pagamentos desta costura
        </h2>
        <div className="btn-row">
          <button className="btn btn-primary btn-sm" type="button" onClick={() => abrir('pagar')}>
            Registrar pagamento
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => abrir('agendar')}>
            <CalendarClock size={16} /> Agendar recebimento
          </button>
        </div>
      </div>
      {lista.rows.length ? (
        <ul className="lista-simples">
          {lista.rows.map((l) => (
            <li key={l.id}>
              <span>
                {formatDateBR(l.status === 'pago' ? l.data_lancamento : l.data_vencimento)} · {l.forma_pagamento || '—'} ·{' '}
                <strong>{moeda(l.valor)}</strong>
              </span>
              {l.status === 'pago' ? (
                <span className="badge badge--ok">Recebido</span>
              ) : (
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => void marcarPago(l)}>
                  Marcar recebido
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="page-sub">Nenhum pagamento registrado.</p>
      )}
      {modal ? (
        <Modal titulo={modal === 'pagar' ? 'Registrar pagamento' : 'Agendar recebimento'} onClose={() => setModal(null)}>
          <form className="stack" onSubmit={salvar}>
            <Field label="Valor" htmlFor="p-valor">
              <MoneyInput id="p-valor" value={valor} onChange={setValor} required />
            </Field>
            <Field label={modal === 'pagar' ? 'Data do pagamento' : 'Receber em'} htmlFor="p-data">
              <input id="p-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Forma de pagamento" htmlFor="p-forma">
              <select id="p-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <button className="btn btn-primary btn-full" type="submit">
              <Save size={18} /> Salvar
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}

function MaterialUsado({ ordemId }: { ordemId: string }) {
  const { user } = useAuth()
  const { push } = useToast()
  const produtos = useLista<Produto>('produtos', 'ativo=eq.true&order=nome.asc')
  const usados = useLista<Movimento>('movimentos_estoque', `ordem_id=eq.${ordemId}&order=created_at.asc`)
  const [aberto, setAberto] = useState(false)
  const [produtoId, setProdutoId] = useState('')
  const [qtd, setQtd] = useState('1')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user || !produtoId) return
    const q = Number(qtd.replace(',', '.'))
    if (!(q > 0)) return push('warn', 'Informe a quantidade usada.')
    const r = await inserir('movimentos_estoque', {
      account_id: user.accountId,
      produto_id: produtoId,
      tipo: 'saida',
      quantidade: q,
      ordem_id: ordemId,
      data_movimento: hojeISO(),
      observacao: 'Usado na costura',
    })
    if (r.error) return push('error', r.error)
    push('ok', 'Material baixado do estoque.')
    setAberto(false)
    setProdutoId('')
    setQtd('1')
    void usados.reload()
  }

  const nome = (pid: string) => produtos.rows.find((p) => p.id === pid)
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="section-title">
          <Package size={18} /> Material usado
        </h2>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setAberto(true)} disabled={!produtos.rows.length}>
          <Plus size={16} /> Usar material
        </button>
      </div>
      {!produtos.rows.length ? <p className="page-sub">Cadastre linhas, agulhas e outros itens em Estoque para dar baixa aqui.</p> : null}
      {usados.rows.length ? (
        <ul className="lista-simples">
          {usados.rows.map((m) => (
            <li key={m.id}>
              <span>
                {nome(m.produto_id)?.nome || 'Produto'} · {numeroBR(Math.abs(Number(m.quantidade)), 2)} {nome(m.produto_id)?.unidade || ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {aberto ? (
        <Modal titulo="Usar material do estoque" onClose={() => setAberto(false)}>
          <form className="stack" onSubmit={salvar}>
            <Field label="Produto" htmlFor="mu-prod">
              <select id="mu-prod" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} required>
                <option value="">Escolha…</option>
                {produtos.rows.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} (tem {numeroBR(Number(p.estoque_atual), 2)} {p.unidade})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantidade usada" htmlFor="mu-qtd">
              <input id="mu-qtd" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ''))} />
            </Field>
            <button className="btn btn-primary btn-full" type="submit">
              <Scissors size={18} /> Dar baixa
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
