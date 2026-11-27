import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookUser, ClipboardPaste, FileUp, MessageCircle, Plus, Ruler, Save, Scissors, Trash2 } from 'lucide-react'
import { ErrorState, Field, ListaOpcoes, Loading, Modal, PageHeader, StatusBadge } from '../components/ui'
import { WhatsAppDialog } from '../components/WhatsAppDialog'
import { useAuth } from '../lib/auth'
import { apagar, atualizar, buscar, inserir, listar } from '../lib/db'
import { useLista, usePreferencias } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { buscarCep, escolherDaAgenda, lerTextoColado, lerVcard, podeAbrirAgenda, type ContatoImportado } from '../lib/contatos'
import { COMO_CONHECEU } from '../lib/costura'
import {
  cpfValido,
  formatDateBR,
  hojeISO,
  mascaraCep,
  mascaraCpf,
  mascaraTelefone,
  moeda,
  soDigitos,
} from '../lib/format'
import type { Cliente, Medida, OrdemResumo } from '../lib/types'

type FormCliente = {
  nome_completo: string
  cpf: string
  telefone: string
  email: string
  data_nascimento: string
  cep: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  como_conheceu: string
  observacoes: string
}

const VAZIO: FormCliente = {
  nome_completo: '',
  cpf: '',
  telefone: '',
  email: '',
  data_nascimento: '',
  cep: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: '',
  como_conheceu: '',
  observacoes: '',
}

const CAMPOS_MEDIDA: { key: keyof Medida; label: string }[] = [
  { key: 'busto', label: 'Busto' },
  { key: 'cintura', label: 'Cintura' },
  { key: 'quadril', label: 'Quadril' },
  { key: 'ombro', label: 'Ombro a ombro' },
  { key: 'pescoco', label: 'Pescoço' },
  { key: 'braco', label: 'Braço' },
  { key: 'manga', label: 'Comprimento da manga' },
  { key: 'comprimento_blusa', label: 'Comprimento da blusa' },
  { key: 'comprimento_saia', label: 'Comprimento da saia' },
  { key: 'comprimento_calca', label: 'Comprimento da calça' },
  { key: 'gancho', label: 'Gancho' },
  { key: 'coxa', label: 'Coxa' },
  { key: 'joelho', label: 'Joelho' },
  { key: 'barra', label: 'Barra' },
]

export function ClienteFormPage() {
  const { id } = useParams()
  const editando = Boolean(id)
  const { user } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const { prefs } = usePreferencias()
  const [form, setForm] = useState<FormCliente>(VAZIO)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(editando)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [colar, setColar] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [whats, setWhats] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    void buscar<Cliente>('clientes', id).then((r) => {
      if (!vivo) return
      setLoading(false)
      if (r.error || !r.data) {
        setErroCarga(r.error || 'Cliente não encontrada.')
        return
      }
      const c = r.data
      setCliente(c)
      setForm({
        nome_completo: c.nome_completo,
        cpf: mascaraCpf(c.cpf),
        telefone: mascaraTelefone(c.telefone),
        email: c.email || '',
        data_nascimento: c.data_nascimento || '',
        cep: mascaraCep(c.cep),
        endereco: c.endereco || '',
        bairro: c.bairro || '',
        cidade: c.cidade || '',
        uf: c.uf || '',
        como_conheceu: c.como_conheceu || '',
        observacoes: c.observacoes || '',
      })
    })
    return () => {
      vivo = false
    }
  }, [id])

  function set<K extends keyof FormCliente>(k: K, v: FormCliente[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function aplicarContato(c: ContatoImportado | null) {
    if (!c) {
      push('warn', 'Não consegui ler esse contato. Confira e tente de novo.')
      return
    }
    setForm((f) => ({
      ...f,
      nome_completo: c.nome || f.nome_completo,
      telefone: c.telefone ? mascaraTelefone(c.telefone) : f.telefone,
      email: c.email || f.email,
      endereco: c.endereco || f.endereco,
      bairro: c.bairro || f.bairro,
      cidade: c.cidade || f.cidade,
      uf: c.uf || f.uf,
      cep: c.cep ? mascaraCep(c.cep) : f.cep,
    }))
    push('ok', 'Contato importado. Agora complete o CPF e os outros dados.')
  }

  async function abrirAgenda() {
    try {
      aplicarContato(await escolherDaAgenda())
    } catch {
      push('warn', 'A agenda não abriu. Use "Colar contato" ou "Arquivo de contato".')
    }
  }

  async function onArquivo(file?: File | null) {
    if (!file) return
    aplicarContato(lerVcard(await file.text()))
    if (arquivoRef.current) arquivoRef.current.value = ''
  }

  async function onCep(valor: string) {
    set('cep', mascaraCep(valor))
    if (soDigitos(valor).length === 8) {
      const end = await buscarCep(valor)
      if (end) {
        setForm((f) => ({
          ...f,
          endereco: f.endereco || end.endereco || '',
          bairro: end.bairro || f.bairro,
          cidade: end.cidade || f.cidade,
          uf: end.uf || f.uf,
        }))
      }
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setErro(null)
    const cpf = soDigitos(form.cpf)
    if (!form.nome_completo.trim()) return setErro('Informe o nome completo.')
    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os 11 números.')
    if (soDigitos(form.telefone).length < 10) return setErro('Informe o telefone com DDD (ex.: 66 99999-1234).')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErro('E-mail inválido.')

    setBusy(true)
    // Aviso de duplicidade por CPF (o banco também bloqueia) e por telefone.
    const dup = await listar<Pick<Cliente, 'id' | 'nome_completo' | 'cpf' | 'telefone'>>(
      'clientes',
      `select=id,nome_completo,cpf,telefone&or=(cpf.eq.${cpf},telefone.eq.${soDigitos(form.telefone)})`,
    )
    const outro = (dup.data || []).find((c) => c.id !== id)
    if (outro && outro.cpf === cpf) {
      setBusy(false)
      return setErro(`Já existe uma cliente com este CPF: ${outro.nome_completo}.`)
    }
    if (outro && !window.confirm(`O telefone já está no cadastro de ${outro.nome_completo}. Salvar mesmo assim?`)) {
      setBusy(false)
      return
    }

    const linha = {
      nome_completo: form.nome_completo.trim(),
      cpf,
      telefone: soDigitos(form.telefone),
      email: form.email.trim().toLowerCase() || null,
      data_nascimento: form.data_nascimento || null,
      cep: soDigitos(form.cep) || null,
      endereco: form.endereco.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase().slice(0, 2) || null,
      como_conheceu: form.como_conheceu || null,
      observacoes: form.observacoes.trim() || null,
    }
    const r = id ? await atualizar<Cliente>('clientes', id, linha) : await inserir<Cliente>('clientes', { ...linha, account_id: user.accountId })
    setBusy(false)
    if (r.error) return setErro(r.error)
    push('ok', id ? 'Cliente atualizada.' : 'Cliente cadastrada.')
    const novoId = r.data?.[0]?.id
    if (!id && novoId && (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-acao') === 'costura') {
      navigate(`/app/costuras/nova?cliente=${novoId}`)
      return
    }
    navigate('/app/dashboard')
  }

  async function onExcluir() {
    if (!id || !window.confirm('Excluir esta cliente? Só é possível se ela não tiver costuras registradas.')) return
    const r = await apagar('clientes', id)
    if (r.error) {
      push('error', r.error.includes('ligado') ? 'Esta cliente tem costuras registradas. Ela não pode ser excluída.' : r.error)
      return
    }
    push('ok', 'Cliente excluída.')
    navigate('/app/clientes')
  }

  if (loading) return <Loading />
  if (erroCarga) return <ErrorState texto={erroCarga} />

  return (
    <div className="page">
      <PageHeader
        title={editando ? form.nome_completo || 'Cliente' : 'Nova cliente'}
        sub={editando ? 'Altere os dados e toque em Salvar.' : 'Puxe o contato do celular e depois complete os dados.'}
        actions={
          editando && cliente ? (
            <>
              <Link className="btn btn-primary" to={`/app/costuras/nova?cliente=${cliente.id}`}>
                <Scissors size={18} /> Nova costura
              </Link>
              <button className="btn btn-whats" type="button" disabled={!cliente.telefone} onClick={() => setWhats(true)}>
                <MessageCircle size={18} /> WhatsApp
              </button>
            </>
          ) : null
        }
      />

      {!editando ? (
        <section className="card">
          <h2 className="section-title">1. Puxar o contato do celular</h2>
          <p className="page-sub">Escolha um jeito. Os dados aparecem no formulário para você só completar.</p>
          <div className="btn-row">
            {podeAbrirAgenda() ? (
              <button className="btn btn-primary" type="button" onClick={abrirAgenda}>
                <BookUser size={18} /> Escolher da agenda / WhatsApp
              </button>
            ) : null}
            <button className="btn btn-secondary" type="button" onClick={() => setColar(true)}>
              <ClipboardPaste size={18} /> Colar contato
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => arquivoRef.current?.click()}>
              <FileUp size={18} /> Arquivo de contato (.vcf)
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept=".vcf,text/vcard,text/x-vcard"
              hidden
              onChange={(e) => void onArquivo(e.target.files?.[0])}
            />
          </div>
          <p className="field-hint">
            No WhatsApp: abra a conversa da cliente, toque no nome dela, copie o número e use “Colar contato”. Ou use
            “Compartilhar contato” e salve o arquivo .vcf.
          </p>
        </section>
      ) : null}

      <form className="card form-grid" onSubmit={onSubmit} noValidate>
        <h2 className="section-title span-all">{editando ? 'Dados da cliente' : '2. Dados da cliente'}</h2>
        {erro ? <div className="alert alert-error span-all">{erro}</div> : null}
        <Field label="Nome completo *" htmlFor="c-nome">
          <input id="c-nome" required value={form.nome_completo} onChange={(e) => set('nome_completo', e.target.value)} autoComplete="name" />
        </Field>
        <Field label="CPF *" htmlFor="c-cpf" dica="Evita cadastro repetido. Só números.">
          <input id="c-cpf" inputMode="numeric" required value={form.cpf} onChange={(e) => set('cpf', mascaraCpf(e.target.value))} placeholder="000.000.000-00" />
        </Field>
        <Field label="Telefone / WhatsApp *" htmlFor="c-tel">
          <input id="c-tel" inputMode="tel" required value={form.telefone} onChange={(e) => set('telefone', mascaraTelefone(e.target.value))} placeholder="(66) 99999-1234" />
        </Field>
        <Field label="E-mail" htmlFor="c-email">
          <input id="c-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="cliente@email.com" />
        </Field>
        <Field label="Data de nascimento" htmlFor="c-nasc" dica="Para lembrar do aniversário.">
          <input id="c-nasc" type="date" value={form.data_nascimento} onChange={(e) => set('data_nascimento', e.target.value)} />
        </Field>
        <Field label="Como conheceu o ateliê" htmlFor="c-como">
          <select id="c-como" value={form.como_conheceu} onChange={(e) => set('como_conheceu', e.target.value)}>
            <option value="">Escolha…</option>
            {COMO_CONHECEU.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="CEP" htmlFor="c-cep" dica="Digite o CEP e o endereço aparece sozinho.">
          <input id="c-cep" inputMode="numeric" value={form.cep} onChange={(e) => void onCep(e.target.value)} placeholder="78850-000" />
        </Field>
        <Field label="Rua e número" htmlFor="c-end">
          <input id="c-end" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} />
        </Field>
        <Field label="Bairro" htmlFor="c-bairro">
          <input id="c-bairro" value={form.bairro} onChange={(e) => set('bairro', e.target.value)} />
        </Field>
        <Field label="Cidade" htmlFor="c-cidade">
          <input id="c-cidade" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
        </Field>
        <Field label="UF" htmlFor="c-uf">
          <input id="c-uf" maxLength={2} value={form.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} placeholder="MT" />
        </Field>
        <div className="field span-all">
          <label className="field-label" htmlFor="c-obs">
            Observações
          </label>
          <textarea id="c-obs" rows={3} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Ex.: prefere entrega à tarde" />
        </div>
        <div className="btn-row span-all">
          <button className="btn btn-primary" type="submit" disabled={busy} data-acao="salvar">
            <Save size={18} /> {busy ? 'Salvando…' : 'Salvar'}
          </button>
          {!editando ? (
            <button className="btn btn-secondary" type="submit" disabled={busy} data-acao="costura">
              <Scissors size={18} /> Salvar e receber costura
            </button>
          ) : (
            <button className="btn btn-danger" type="button" onClick={onExcluir}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
        </div>
      </form>

      {editando && cliente ? (
        <>
          <MedidasCliente clienteId={cliente.id} />
          <HistoricoCliente clienteId={cliente.id} />
        </>
      ) : null}

      {colar ? (
        <Modal titulo="Colar contato" onClose={() => setColar(false)}>
          <p className="page-sub">Cole aqui o nome e o número copiados do WhatsApp (ou o texto de um contato compartilhado).</p>
          <textarea rows={5} value={textoColado} onChange={(e) => setTextoColado(e.target.value)} placeholder="Maria Aparecida Souza +55 66 99999-1234" />
          <button
            className="btn btn-primary btn-full"
            type="button"
            onClick={() => {
              aplicarContato(lerTextoColado(textoColado))
              setColar(false)
              setTextoColado('')
            }}
          >
            Usar estes dados
          </button>
        </Modal>
      ) : null}

      {whats && cliente ? (
        <WhatsAppDialog
          alvo={{ cliente_nome: cliente.nome_completo, cliente_telefone: cliente.telefone, cliente_id: cliente.id }}
          prefs={prefs}
          tipoInicial="livre"
          onClose={() => setWhats(false)}
        />
      ) : null}
      <ListaOpcoes id="lista-como" opcoes={COMO_CONHECEU} />
    </div>
  )
}

function MedidasCliente({ clienteId }: { clienteId: string }) {
  const { user } = useAuth()
  const { push } = useToast()
  const { rows, reload } = useLista<Medida>('medidas', `cliente_id=eq.${clienteId}&order=data_medida.desc`)
  const [aberta, setAberta] = useState<Partial<Medida> | null>(null)
  const ultima = rows[0]

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user || !aberta) return
    const linha: Record<string, unknown> = { data_medida: aberta.data_medida || hojeISO(), observacoes: aberta.observacoes || null }
    CAMPOS_MEDIDA.forEach(({ key }) => {
      const v = aberta[key]
      linha[key] = v === '' || v == null ? null : Number(String(v).replace(',', '.'))
    })
    const r = aberta.id
      ? await atualizar('medidas', aberta.id, linha)
      : await inserir('medidas', { ...linha, account_id: user.accountId, cliente_id: clienteId })
    if (r.error) return push('error', r.error)
    push('ok', 'Medidas salvas.')
    setAberta(null)
    void reload()
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="section-title">
          <Ruler size={18} /> Medidas (cm)
        </h2>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setAberta({ data_medida: hojeISO() })}>
          <Plus size={16} /> Nova medida
        </button>
      </div>
      {ultima ? (
        <>
          <p className="page-sub">Última medida em {formatDateBR(ultima.data_medida)}.</p>
          <div className="medidas-grid">
            {CAMPOS_MEDIDA.filter(({ key }) => ultima[key] != null).map(({ key, label }) => (
              <div key={key} className="medida">
                <span>{label}</span>
                <strong>{String(ultima[key]).replace('.', ',')}</strong>
              </div>
            ))}
          </div>
          {ultima.observacoes ? <p className="page-sub">{ultima.observacoes}</p> : null}
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAberta(ultima)}>
              Editar esta medida
            </button>
            {rows.length > 1 ? <small className="field-hint">{rows.length} medidas guardadas</small> : null}
          </div>
        </>
      ) : (
        <p className="page-sub">Nenhuma medida guardada ainda.</p>
      )}
      {aberta ? (
        <Modal titulo="Medidas da cliente (cm)" onClose={() => setAberta(null)} largo>
          <form className="form-grid" onSubmit={salvar}>
            <Field label="Data" htmlFor="m-data">
              <input id="m-data" type="date" value={aberta.data_medida || ''} onChange={(e) => setAberta({ ...aberta, data_medida: e.target.value })} />
            </Field>
            {CAMPOS_MEDIDA.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={`m-${key}`}>
                <input
                  id={`m-${key}`}
                  inputMode="decimal"
                  value={aberta[key] == null ? '' : String(aberta[key])}
                  onChange={(e) => setAberta({ ...aberta, [key]: e.target.value.replace(/[^\d.,]/g, '') })}
                />
              </Field>
            ))}
            <div className="field span-all">
              <label className="field-label" htmlFor="m-obs">
                Observações
              </label>
              <textarea id="m-obs" rows={2} value={aberta.observacoes || ''} onChange={(e) => setAberta({ ...aberta, observacoes: e.target.value })} />
            </div>
            <button className="btn btn-primary span-all" type="submit">
              <Save size={18} /> Salvar medidas
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}

function HistoricoCliente({ clienteId }: { clienteId: string }) {
  const { rows } = useLista<OrdemResumo>('ordens_resumo', `cliente_id=eq.${clienteId}&order=data_recebimento.desc`)
  const totais = useMemo(
    () => ({
      gasto: rows.filter((o) => o.status !== 'cancelada').reduce((s, o) => s + Number(o.valor_pago), 0),
      devendo: rows.filter((o) => o.status !== 'cancelada').reduce((s, o) => s + Number(o.saldo), 0),
    }),
    [rows],
  )
  return (
    <section className="card">
      <h2 className="section-title">
        <Scissors size={18} /> Costuras desta cliente
      </h2>
      <p className="page-sub">
        Já pagou: <strong>{moeda(totais.gasto)}</strong> · Em aberto:{' '}
        <strong className={totais.devendo > 0 ? 'txt-erro' : ''}>{moeda(totais.devendo)}</strong>
      </p>
      {rows.length ? (
        <ul className="lista-simples">
          {rows.map((o) => (
            <li key={o.id}>
              <Link to={`/app/costuras/${o.id}`}>
                Nº {o.numero} · {formatDateBR(o.data_recebimento)} · {o.resumo_pecas || 'sem peças'}
              </Link>
              <StatusBadge status={o.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="page-sub">Nenhuma costura registrada ainda.</p>
      )}
    </section>
  )
}
