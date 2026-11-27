import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { ErrorState, Loading } from '../components/ui'
import { buscar, listar } from '../lib/db'
import { usePreferencias } from '../lib/hooks'
import { rotuloStatus } from '../lib/costura'
import { formatDateBR, formatHora, mascaraTelefone, moeda } from '../lib/format'
import type { OrdemItem, OrdemResumo } from '../lib/types'

/** Comprovante de recebimento da costura (imprimir ou salvar em PDF), com canhoto para a cliente. */
export function ReciboPage() {
  const { id } = useParams()
  const { prefs } = usePreferencias()
  const [ordem, setOrdem] = useState<OrdemResumo | null>(null)
  const [itens, setItens] = useState<OrdemItem[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void Promise.all([buscar<OrdemResumo>('ordens_resumo', id), listar<OrdemItem>('ordem_itens', `ordem_id=eq.${id}&order=created_at.asc`)]).then(
      ([o, i]) => {
        if (o.error || !o.data) return setErro(o.error || 'Costura não encontrada.')
        setOrdem(o.data)
        setItens(i.data || [])
      },
    )
  }, [id])

  if (erro) return <ErrorState texto={erro} />
  if (!ordem) return <Loading />

  const via = (titulo: string) => (
    <div className="recibo-via">
      <div className="recibo-topo">
        <div>
          <strong>{prefs?.nome_atelie || 'Meu ateliê'}</strong>
          <small>{[prefs?.telefone_atelie && mascaraTelefone(prefs.telefone_atelie), prefs?.endereco_atelie].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="recibo-num">
          <span>{titulo}</span>
          <strong>Nº {ordem.numero}</strong>
        </div>
      </div>
      <p>
        <strong>Cliente:</strong> {ordem.cliente_nome} {ordem.cliente_telefone ? `· ${mascaraTelefone(ordem.cliente_telefone)}` : ''}
      </p>
      <p>
        <strong>Recebida:</strong> {formatDateBR(ordem.data_recebimento)} · <strong>Entrega:</strong> {formatDateBR(ordem.data_entrega)}{' '}
        {ordem.hora_entrega ? formatHora(ordem.hora_entrega) : ''}
        {ordem.data_prova ? ` · Prova: ${formatDateBR(ordem.data_prova)}` : ''}
      </p>
      <table className="recibo-tabela">
        <thead>
          <tr>
            <th>Peça</th>
            <th>Serviço / o que modificar</th>
            <th>Qtd</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id}>
              <td>
                {i.tipo_peca}
                {i.cor ? ` (${i.cor})` : ''}
              </td>
              <td>
                {i.tipo_servico}
                {i.descricao ? ` — ${i.descricao}` : ''}
              </td>
              <td>{i.quantidade}</td>
              <td>{moeda(Number(i.quantidade) * Number(i.valor_unitario))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="recibo-totais">
        Total: <strong>{moeda(ordem.valor_total)}</strong> · Pago: <strong>{moeda(ordem.valor_pago)}</strong> · Falta:{' '}
        <strong>{moeda(ordem.saldo)}</strong> · Situação: {rotuloStatus(ordem.status)}
      </p>
      {prefs?.chave_pix ? <p>Pix: {prefs.chave_pix}</p> : null}
      {ordem.observacoes ? <p>Obs.: {ordem.observacoes}</p> : null}
      <p className="recibo-assin">Assinatura: ______________________________</p>
    </div>
  )

  return (
    <div className="page recibo-page">
      <div className="btn-row no-print">
        <Link className="btn btn-ghost" to={`/app/costuras/${ordem.id}`}>
          <ArrowLeft size={16} /> Voltar
        </Link>
        <button className="btn btn-primary" type="button" onClick={() => window.print()}>
          <Printer size={18} /> Imprimir ou salvar PDF
        </button>
      </div>
      {via('Via do ateliê')}
      <div className="recibo-corte" aria-hidden="true">
        ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      </div>
      {via('Via da cliente')}
    </div>
  )
}
