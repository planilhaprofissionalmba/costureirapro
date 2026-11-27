import { useMemo, useState } from 'react'
import { Cake, MessageCircle } from 'lucide-react'
import { EmptyState, Loading, PageHeader } from '../components/ui'
import { WhatsAppDialog } from '../components/WhatsAppDialog'
import { useLista, usePreferencias } from '../lib/hooks'
import { linkWhatsCliente, ordemAberta, type TipoMensagem } from '../lib/costura'
import { compararNome, diasEntre, formatDateBR, formatDateTimeBR, hojeISO, moeda, primeiroNome } from '../lib/format'
import type { Cliente, EnvioWhatsapp, OrdemResumo } from '../lib/types'

type Grupo = { chave: string; titulo: string; dica: string; tipo: TipoMensagem; itens: OrdemResumo[] }

export function MensagensPage() {
  const { prefs } = usePreferencias()
  const hoje = hojeISO()
  const ordens = useLista<OrdemResumo>('ordens_resumo', 'status=neq.cancelada&order=data_entrega.asc')
  const clientes = useLista<Cliente>('clientes', 'select=id,nome_completo,telefone,data_nascimento&data_nascimento=not.is.null')
  const envios = useLista<EnvioWhatsapp>('envios_whatsapp', 'order=enviado_em.desc&limit=30')
  const [alvo, setAlvo] = useState<{ o: OrdemResumo; tipo: TipoMensagem } | null>(null)

  const grupos: Grupo[] = useMemo(() => {
    const ab = ordens.rows.filter((o) => ordemAberta(o.status))
    const porNome = (l: OrdemResumo[]) => l.sort((a, b) => compararNome(a.cliente_nome, b.cliente_nome))
    return [
      { chave: 'prontas', titulo: 'Peças prontas — avisar para buscar', dica: 'Costuras marcadas como “Pronta para entregar”.', tipo: 'pronta', itens: porNome(ab.filter((o) => o.status === 'pronta')) },
      {
        chave: 'entregas',
        titulo: 'Entregas de hoje até 2 dias',
        dica: 'Lembrete para a cliente vir buscar ou receber.',
        tipo: 'lembrete',
        itens: porNome(ab.filter((o) => o.status !== 'pronta' && diasEntre(hoje, o.data_entrega) >= 0 && diasEntre(hoje, o.data_entrega) <= 2)),
      },
      {
        chave: 'provas',
        titulo: 'Provas de roupa nos próximos 2 dias',
        dica: 'Confirme o horário da prova.',
        tipo: 'prova',
        itens: porNome(ab.filter((o) => o.data_prova && diasEntre(hoje, o.data_prova) >= 0 && diasEntre(hoje, o.data_prova) <= 2)),
      },
      {
        chave: 'cobrancas',
        titulo: 'Pagamentos pendentes',
        dica: 'Costuras com valor em aberto (as já entregues primeiro).',
        tipo: 'cobranca',
        itens: ordens.rows
          .filter((o) => Number(o.saldo) > 0)
          .sort((a, b) => Number(b.status === 'entregue') - Number(a.status === 'entregue') || compararNome(a.cliente_nome, b.cliente_nome)),
      },
    ]
  }, [ordens.rows, hoje])

  const mesAtual = hoje.slice(5, 7)
  const aniversariantes = clientes.rows
    .filter((c) => c.data_nascimento?.slice(5, 7) === mesAtual)
    .sort((a, b) => (a.data_nascimento || '').slice(8).localeCompare((b.data_nascimento || '').slice(8)))

  return (
    <div className="page">
      <PageHeader title="Mensagens WhatsApp" sub="Quem você precisa avisar hoje. Toque em Enviar: o WhatsApp abre com a mensagem pronta." />
      {ordens.loading ? (
        <Loading />
      ) : (
        <div className="stack">
          {grupos.map((g) => (
            <section key={g.chave} className="card">
              <h2 className="section-title">
                {g.titulo} <span className="badge badge--neutro">{g.itens.length}</span>
              </h2>
              <p className="page-sub">{g.dica}</p>
              {g.itens.length ? (
                <ul className="lista-simples">
                  {g.itens.map((o) => (
                    <li key={`${g.chave}-${o.id}`}>
                      <span>
                        <strong>{o.cliente_nome}</strong> · Nº {o.numero} · entrega {formatDateBR(o.data_entrega)}
                        {g.tipo === 'cobranca' ? ` · falta ${moeda(o.saldo)}` : ''}
                      </span>
                      <button className="btn btn-whats btn-sm" type="button" disabled={!o.cliente_telefone} onClick={() => setAlvo({ o, tipo: g.tipo })}>
                        <MessageCircle size={16} /> Enviar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="page-sub">Ninguém nesta lista agora.</p>
              )}
            </section>
          ))}

          <section className="card">
            <h2 className="section-title">
              <Cake size={18} /> Aniversariantes do mês
            </h2>
            {aniversariantes.length ? (
              <ul className="lista-simples">
                {aniversariantes.map((c) => {
                  const link = linkWhatsCliente(
                    c.telefone,
                    `Feliz aniversário, ${primeiroNome(c.nome_completo)}! Muita saúde e alegria. Um abraço do ${prefs?.nome_atelie || 'seu ateliê'}.`,
                  )
                  return (
                    <li key={c.id}>
                      <span>
                        <strong>{c.nome_completo}</strong> · dia {c.data_nascimento?.slice(8)}
                      </span>
                      {link ? (
                        <a className="btn btn-whats btn-sm" href={link} target="_blank" rel="noreferrer">
                          <MessageCircle size={16} /> Parabéns
                        </a>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="page-sub">Nenhuma cliente faz aniversário este mês (ou falta a data de nascimento no cadastro).</p>
            )}
          </section>

          <section className="card">
            <h2 className="section-title">Últimas mensagens abertas</h2>
            {envios.rows.length ? (
              <ul className="lista-simples">
                {envios.rows.map((e) => (
                  <li key={e.id}>
                    <span>
                      {formatDateTimeBR(e.enviado_em)} · {e.mensagem.slice(0, 90)}
                      {e.mensagem.length > 90 ? '…' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState texto="Nenhuma mensagem enviada pelo app ainda." />
            )}
          </section>
        </div>
      )}
      {alvo ? <WhatsAppDialog alvo={alvo.o} prefs={prefs} tipoInicial={alvo.tipo} onClose={() => setAlvo(null)} onEnviado={() => void envios.reload()} /> : null}
    </div>
  )
}
