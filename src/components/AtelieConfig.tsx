import { type FormEvent, useEffect, useState } from 'react'
import { MessageSquareText, RotateCcw, Save, Store } from 'lucide-react'
import { Field } from './ui'
import { useAuth } from '../lib/auth'
import { salvarUnico } from '../lib/db'
import { usePreferencias } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { MENSAGENS_PADRAO, ROTULO_MENSAGEM } from '../lib/costura'
import { mascaraTelefone, soDigitos } from '../lib/format'

type Chave = keyof typeof MENSAGENS_PADRAO

/** Dados do ateliê (recibo, mensagens) e modelos de WhatsApp. Fica abaixo de conta/senha/instalar. */
export function AtelieConfig() {
  const { user } = useAuth()
  const { push } = useToast()
  const { prefs, reload } = usePreferencias()
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [end, setEnd] = useState('')
  const [pix, setPix] = useState('')
  const [prazo, setPrazo] = useState('7')
  const [msgs, setMsgs] = useState<Record<Chave, string>>({ ...MENSAGENS_PADRAO })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!prefs) return
    setNome(prefs.nome_atelie || '')
    setTel(mascaraTelefone(prefs.telefone_atelie))
    setEnd(prefs.endereco_atelie || '')
    setPix(prefs.chave_pix || '')
    setPrazo(String(prefs.prazo_padrao_dias ?? 7))
    setMsgs({
      msg_pronta: prefs.msg_pronta || MENSAGENS_PADRAO.msg_pronta,
      msg_lembrete: prefs.msg_lembrete || MENSAGENS_PADRAO.msg_lembrete,
      msg_cobranca: prefs.msg_cobranca || MENSAGENS_PADRAO.msg_cobranca,
      msg_prova: prefs.msg_prova || MENSAGENS_PADRAO.msg_prova,
    })
  }, [prefs])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    const r = await salvarUnico('preferencias', 'account_id', {
      account_id: user.accountId,
      nome_atelie: nome.trim() || null,
      telefone_atelie: soDigitos(tel) || null,
      endereco_atelie: end.trim() || null,
      chave_pix: pix.trim() || null,
      prazo_padrao_dias: Math.min(365, Math.max(0, Number(prazo) || 0)),
      ...msgs,
    })
    setBusy(false)
    if (r.error) return push('error', r.error)
    push('ok', 'Dados do ateliê salvos.')
    void reload()
  }

  return (
    <form className="card form-grid" id="atelie" onSubmit={salvar}>
      <h2 className="section-title span-all">
        <Store size={18} /> Meu ateliê
      </h2>
      <p className="page-sub span-all">Esses dados aparecem no recibo e nas mensagens de WhatsApp.</p>
      <Field label="Nome do ateliê" htmlFor="at-nome">
        <input id="at-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ateliê da Maria" />
      </Field>
      <Field label="Telefone do ateliê" htmlFor="at-tel">
        <input id="at-tel" inputMode="tel" value={tel} onChange={(e) => setTel(mascaraTelefone(e.target.value))} />
      </Field>
      <Field label="Endereço" htmlFor="at-end">
        <input id="at-end" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Field label="Chave Pix" htmlFor="at-pix" dica="Vai na mensagem de cobrança.">
        <input id="at-pix" value={pix} onChange={(e) => setPix(e.target.value)} />
      </Field>
      <Field label="Prazo padrão de entrega (dias)" htmlFor="at-prazo">
        <input id="at-prazo" inputMode="numeric" value={prazo} onChange={(e) => setPrazo(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </Field>

      <h3 className="sub-title span-all">
        <MessageSquareText size={16} /> Modelos de mensagem do WhatsApp
      </h3>
      <p className="field-hint span-all">
        Palavras entre chaves são trocadas sozinhas: {'{nome}'} {'{numero}'} {'{pecas}'} {'{data_entrega}'} {'{data_prova}'} {'{saldo}'}{' '}
        {'{saldo_texto}'} {'{valor_total}'} {'{pix}'} {'{atelie}'}
      </p>
      {(Object.keys(MENSAGENS_PADRAO) as Chave[]).map((k) => (
        <div key={k} className="field span-all">
          <label className="field-label" htmlFor={`at-${k}`}>
            {ROTULO_MENSAGEM[k.replace('msg_', '') as 'pronta']}
          </label>
          <textarea id={`at-${k}`} rows={3} value={msgs[k]} onChange={(e) => setMsgs({ ...msgs, [k]: e.target.value })} />
          <button className="linkish" type="button" onClick={() => setMsgs({ ...msgs, [k]: MENSAGENS_PADRAO[k] })}>
            <RotateCcw size={14} /> Voltar ao texto padrão
          </button>
        </div>
      ))}
      <button className="btn btn-primary span-all" type="submit" disabled={busy}>
        <Save size={18} /> {busy ? 'Salvando…' : 'Salvar dados do ateliê'}
      </button>
    </form>
  )
}
