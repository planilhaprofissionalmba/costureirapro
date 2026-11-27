import { type FormEvent, useState } from 'react'
import { CheckCircle2, PackageCheck } from 'lucide-react'
import { Field, Modal, MoneyInput } from './ui'
import { useAuth } from '../lib/auth'
import { atualizar, inserir } from '../lib/db'
import { useLista } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { FORMAS_PAGAMENTO } from '../lib/costura'
import { formatDateBR, hojeISO, mascaraMoeda, moeda, parseMoeda, somarDias } from '../lib/format'
import type { Lancamento, OrdemResumo } from '../lib/types'

/**
 * Entrega da costura ligada ao recebimento:
 * 1) mostra total, já recebido e quanto falta;
 * 2) confere os recebimentos agendados (botão "Recebi");
 * 3) registra o pagamento de agora no caixa;
 * 4) o que sobrar vira "a receber" (fiado) com vencimento — ou bloqueia a entrega;
 * 5) baixa a costura: situação "Entregue" e data de entrega real = hoje.
 */
export function EntregaDialog({ ordem, onClose, onEntregue }: { ordem: OrdemResumo; onClose: () => void; onEntregue: () => void }) {
  const { user } = useAuth()
  const { push } = useToast()
  const pendentes = useLista<Lancamento>(
    'lancamentos',
    `ordem_id=eq.${ordem.id}&tipo=eq.entrada&status=eq.pendente&order=data_vencimento.asc`,
  )
  const [recebidoExtra, setRecebidoExtra] = useState(0)
  const saldoAtual = Math.max(0, Number(ordem.saldo) - recebidoExtra)
  const somaPendentes = pendentes.rows.reduce((s, l) => s + Number(l.valor), 0)
  const [valor, setValor] = useState(() => (Number(ordem.saldo) > 0 ? mascaraMoeda(Number(ordem.saldo).toFixed(2)) : ''))
  const [forma, setForma] = useState('Pix')
  const [conferido, setConferido] = useState(false)
  const [fiado, setFiado] = useState(false)
  const [vencimento, setVencimento] = useState(somarDias(hojeISO(), 7))
  const [busy, setBusy] = useState(false)

  const agora = parseMoeda(valor) || 0
  const faltaDepois = Math.max(0, Math.round((saldoAtual - agora - somaPendentes) * 100) / 100)

  async function receberPendente(l: Lancamento) {
    const r = await atualizar('lancamentos', l.id, { status: 'pago', data_lancamento: hojeISO(), forma_pagamento: l.forma_pagamento || forma })
    if (r.error) return push('error', r.error)
    push('ok', `Recebido ${moeda(l.valor)}.`)
    const novoSaldo = Math.max(0, saldoAtual - Number(l.valor))
    setRecebidoExtra((v) => v + Number(l.valor))
    setValor(novoSaldo > 0 ? mascaraMoeda(novoSaldo.toFixed(2)) : '')
    void pendentes.reload()
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (agora > saldoAtual + 0.001) return push('warn', `O valor passa do que falta pagar (${moeda(saldoAtual)}).`)
    if (agora > 0 && !conferido) return push('warn', 'Confira o pagamento (Pix caiu, dinheiro contado) e marque a caixinha.')
    if (faltaDepois > 0 && !fiado) {
      return push('warn', `Ainda faltam ${moeda(faltaDepois)}. Receba tudo ou marque "A cliente vai pagar depois".`)
    }
    setBusy(true)
    const base = {
      account_id: user.accountId,
      tipo: 'entrada',
      categoria: 'Costura / serviço',
      descricao: `Costura nº ${ordem.numero} - ${ordem.cliente_nome}`,
      cliente_id: ordem.cliente_id,
      ordem_id: ordem.id,
    }
    if (agora > 0) {
      const r = await inserir('lancamentos', { ...base, status: 'pago', valor: agora, data_lancamento: hojeISO(), forma_pagamento: forma })
      if (r.error) {
        setBusy(false)
        return push('error', r.error)
      }
    }
    if (faltaDepois > 0 && fiado) {
      const r = await inserir('lancamentos', {
        ...base,
        status: 'pendente',
        valor: faltaDepois,
        data_lancamento: vencimento,
        data_vencimento: vencimento,
        forma_pagamento: forma,
        observacoes: 'Restante combinado na entrega',
      })
      if (r.error) {
        setBusy(false)
        return push('error', r.error)
      }
    }
    const r = await atualizar('ordens', ordem.id, { status: 'entregue', data_entregue: hojeISO() })
    setBusy(false)
    if (r.error) return push('error', r.error)
    push('ok', faltaDepois > 0 ? `Costura entregue. ${moeda(faltaDepois)} ficou em Pendências.` : 'Costura entregue e paga. Baixada!')
    onEntregue()
    onClose()
  }

  return (
    <Modal titulo={`Entregar costura nº ${ordem.numero}`} onClose={onClose}>
      <form className="stack" onSubmit={confirmar}>
        <p className="page-sub">
          <strong>{ordem.cliente_nome}</strong> · {ordem.resumo_pecas || 'sem peças'}
        </p>
        <div className="entrega-resumo">
          <div>
            <small>Total</small>
            <strong>{moeda(ordem.valor_total)}</strong>
          </div>
          <div>
            <small>Já recebido</small>
            <strong className="txt-ok">{moeda(Number(ordem.valor_pago) + recebidoExtra)}</strong>
          </div>
          <div>
            <small>Falta pagar</small>
            <strong className={saldoAtual > 0 ? 'txt-erro' : 'txt-ok'}>{moeda(saldoAtual)}</strong>
          </div>
        </div>

        {pendentes.rows.length ? (
          <div className="stack">
            <p className="field-label">Recebimentos agendados — confira se já pagou</p>
            <ul className="lista-simples">
              {pendentes.rows.map((l) => (
                <li key={l.id}>
                  <span>
                    {formatDateBR(l.data_vencimento)} · {l.forma_pagamento || '—'} · <strong>{moeda(l.valor)}</strong>
                  </span>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => void receberPendente(l)}>
                    Recebi
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {saldoAtual > 0 ? (
          <>
            <Field label="Recebido agora" htmlFor="e-valor" dica="Deixe em branco se a cliente não pagou nada agora.">
              <MoneyInput id="e-valor" value={valor} onChange={setValor} />
            </Field>
            <Field label="Forma de pagamento" htmlFor="e-forma">
              <select id="e-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            {agora > 0 ? (
              <label className="check-line">
                <input type="checkbox" checked={conferido} onChange={(e) => setConferido(e.target.checked)} />
                Conferi o pagamento ({forma === 'Pix' ? 'o Pix caiu na conta' : 'valor recebido certinho'})
              </label>
            ) : null}
            {faltaDepois > 0 ? (
              <>
                <label className="check-line">
                  <input type="checkbox" checked={fiado} onChange={(e) => setFiado(e.target.checked)} />A cliente vai pagar depois os{' '}
                  {moeda(faltaDepois)} que faltam
                </label>
                {fiado ? (
                  <Field label="Vai pagar em" htmlFor="e-venc">
                    <input id="e-venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                  </Field>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className="txt-ok">
            <CheckCircle2 size={16} /> Costura paga. É só confirmar a entrega.
          </p>
        )}

        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          <PackageCheck size={18} /> {busy ? 'Salvando…' : 'Confirmar entrega e baixar'}
        </button>
      </form>
    </Modal>
  )
}
