import { type FormEvent, useState } from 'react'
import { Field, Modal, MoneyInput } from './ui'
import { useAuth } from '../lib/auth'
import { atualizar, inserir } from '../lib/db'
import { useToast } from '../lib/toast'
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, FORMAS_PAGAMENTO } from '../lib/costura'
import { hojeISO, mascaraMoeda, parseMoeda } from '../lib/format'
import type { Cliente, Lancamento } from '../lib/types'

/** Criar/editar lançamento de caixa: entrada ou saída, já pago ou agendado (a receber / a pagar). */
export function LancamentoModal({
  inicial,
  clientes,
  onClose,
  onSalvo,
}: {
  inicial: Partial<Lancamento> & { tipo: 'entrada' | 'saida' }
  clientes: Pick<Cliente, 'id' | 'nome_completo'>[]
  onClose: () => void
  onSalvo: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [tipo, setTipo] = useState<'entrada' | 'saida'>(inicial.tipo)
  const [status, setStatus] = useState<'pago' | 'pendente'>(inicial.status || 'pago')
  const [descricao, setDescricao] = useState(inicial.descricao || '')
  const [categoria, setCategoria] = useState(inicial.categoria || (inicial.tipo === 'entrada' ? CATEGORIAS_ENTRADA[0] : CATEGORIAS_SAIDA[0]))
  const [valor, setValor] = useState(inicial.valor ? mascaraMoeda(Number(inicial.valor).toFixed(2)) : '')
  const [data, setData] = useState(inicial.status === 'pendente' ? inicial.data_vencimento || hojeISO() : inicial.data_lancamento || hojeISO())
  const [forma, setForma] = useState(inicial.forma_pagamento || 'Pix')
  const [cliente, setCliente] = useState(inicial.cliente_id || '')
  const [obs, setObs] = useState(inicial.observacoes || '')
  const [busy, setBusy] = useState(false)
  const categorias = tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const v = parseMoeda(valor)
    if (!descricao.trim()) return push('warn', 'Escreva uma descrição.')
    if (!(v > 0)) return push('warn', 'Informe o valor.')
    setBusy(true)
    const linha = {
      tipo,
      status,
      categoria,
      descricao: descricao.trim(),
      valor: v,
      data_lancamento: data,
      data_vencimento: status === 'pendente' ? data : null,
      forma_pagamento: forma,
      cliente_id: cliente || null,
      observacoes: obs.trim() || null,
    }
    const r = inicial.id ? await atualizar('lancamentos', inicial.id, linha) : await inserir('lancamentos', { ...linha, account_id: user.accountId })
    setBusy(false)
    if (r.error) return push('error', r.error)
    push('ok', status === 'pendente' ? (tipo === 'entrada' ? 'Recebimento agendado.' : 'Pagamento agendado.') : 'Lançado no caixa.')
    onSalvo()
    onClose()
  }

  return (
    <Modal titulo={inicial.id ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form className="stack" onSubmit={salvar}>
        <div className="chips" role="radiogroup" aria-label="Tipo">
          <button type="button" className={`chip ${tipo === 'entrada' ? 'chip--ativo' : ''}`} onClick={() => { setTipo('entrada'); setCategoria(CATEGORIAS_ENTRADA[0]) }}>
            Entrada (recebi)
          </button>
          <button type="button" className={`chip ${tipo === 'saida' ? 'chip--ativo' : ''}`} onClick={() => { setTipo('saida'); setCategoria(CATEGORIAS_SAIDA[0]) }}>
            Saída (paguei)
          </button>
        </div>
        <div className="chips" role="radiogroup" aria-label="Situação">
          <button type="button" className={`chip ${status === 'pago' ? 'chip--ativo' : ''}`} onClick={() => setStatus('pago')}>
            Já foi pago
          </button>
          <button type="button" className={`chip ${status === 'pendente' ? 'chip--ativo' : ''}`} onClick={() => setStatus('pendente')}>
            Agendar para depois
          </button>
        </div>
        <Field label="Descrição *" htmlFor="lc-desc">
          <input id="lc-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === 'entrada' ? 'Ex.: Ajuste de vestido' : 'Ex.: Conta de energia'} />
        </Field>
        <div className="form-grid">
          <Field label="Valor *" htmlFor="lc-valor">
            <MoneyInput id="lc-valor" value={valor} onChange={setValor} required />
          </Field>
          <Field label={status === 'pendente' ? (tipo === 'entrada' ? 'Receber em' : 'Pagar em') : 'Data'} htmlFor="lc-data">
            <input id="lc-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Categoria" htmlFor="lc-cat">
            <select id="lc-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Forma" htmlFor="lc-forma">
            <select id="lc-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
        {tipo === 'entrada' ? (
          <Field label="Cliente (se tiver)" htmlFor="lc-cli">
            <select id="lc-cli" value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Nenhuma</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_completo}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Observações" htmlFor="lc-obs">
          <input id="lc-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}
