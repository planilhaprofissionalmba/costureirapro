import { useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Modal } from './ui'
import { useAuth } from '../lib/auth'
import { inserir } from '../lib/db'
import { useToast } from '../lib/toast'
import { linkWhatsCliente, modeloMensagem, montarMensagem, ROTULO_MENSAGEM, type TipoMensagem } from '../lib/costura'
import { mascaraTelefone } from '../lib/format'
import type { OrdemResumo, Preferencias } from '../lib/types'

type Alvo = Partial<OrdemResumo> & { cliente_nome: string; cliente_telefone: string | null; cliente_id?: string }

/** Escolhe o modelo, mostra a mensagem pronta (dá para editar) e abre o WhatsApp da cliente. */
export function WhatsAppDialog({
  alvo,
  prefs,
  tipoInicial = 'pronta',
  onClose,
  onEnviado,
}: {
  alvo: Alvo
  prefs: Preferencias | null
  tipoInicial?: TipoMensagem
  onClose: () => void
  onEnviado?: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const temOrdem = Boolean(alvo.id)
  const tipos: TipoMensagem[] = temOrdem ? ['pronta', 'lembrete', 'prova', 'cobranca', 'livre'] : ['cobranca', 'livre']
  const [tipo, setTipo] = useState<TipoMensagem>(tipos.includes(tipoInicial) ? tipoInicial : tipos[0])
  const inicial = useMemo(() => montarMensagem(modeloMensagem(tipo, prefs), alvo, prefs), [tipo, prefs, alvo])
  const [texto, setTexto] = useState(inicial)
  const [editado, setEditado] = useState(false)
  const mensagem = editado ? texto : inicial
  const link = linkWhatsCliente(alvo.cliente_telefone, mensagem)

  async function registrar() {
    if (!user) return
    const r = await inserir('envios_whatsapp', {
      account_id: user.accountId,
      cliente_id: alvo.cliente_id || null,
      ordem_id: alvo.id || null,
      tipo,
      mensagem: mensagem.slice(0, 2000),
    })
    if (r.error) push('warn', 'A mensagem foi aberta, mas o histórico não foi salvo.')
    onEnviado?.()
  }

  return (
    <Modal titulo={`WhatsApp para ${alvo.cliente_nome}`} onClose={onClose}>
      <p className="page-sub">
        Telefone: <strong>{alvo.cliente_telefone ? mascaraTelefone(alvo.cliente_telefone) : 'sem telefone cadastrado'}</strong>
      </p>
      <div className="chips" role="radiogroup" aria-label="Tipo de mensagem">
        {tipos.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip ${tipo === t ? 'chip--ativo' : ''}`}
            aria-pressed={tipo === t}
            onClick={() => {
              setTipo(t)
              setEditado(false)
            }}
          >
            {ROTULO_MENSAGEM[t]}
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor="wa-texto">
        Mensagem (pode mudar o texto antes de enviar)
      </label>
      <textarea
        id="wa-texto"
        rows={6}
        value={mensagem}
        onChange={(e) => {
          setEditado(true)
          setTexto(e.target.value)
        }}
      />
      {link ? (
        <a className="btn btn-whats btn-full" href={link} target="_blank" rel="noreferrer" onClick={() => void registrar()}>
          <MessageCircle size={18} /> Abrir no WhatsApp
        </a>
      ) : (
        <div className="alert alert-warn">Cadastre o telefone da cliente para enviar pelo WhatsApp.</div>
      )}
      <p className="field-hint">O WhatsApp abre com a mensagem escrita. Confira e toque em enviar lá.</p>
    </Modal>
  )
}
