import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, HandCoins, Package, Plus, Scissors, Shirt, UserPlus, Wallet } from 'lucide-react'
import { BarrasHorizontais, Colunas, type Barra } from '../components/Charts'
import { ErrorState, KpiCard, Loading, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useLista } from '../lib/hooks'
import { ordemAberta } from '../lib/costura'
import { compararNome, formatDateBR, formatHora, hojeISO, isoLocal, moeda, numeroBR, primeiroNome } from '../lib/format'
import type { Cliente, Compromisso, Lancamento, OrdemItem, OrdemResumo, Produto } from '../lib/types'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function agrupar(lista: { chave: string; valor: number }[], limite = 10): Barra[] {
  const m = new Map<string, number>()
  lista.forEach(({ chave, valor }) => m.set(chave, (m.get(chave) || 0) + valor))
  return [...m.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor || compararNome(a.rotulo, b.rotulo))
    .slice(0, limite)
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const hoje = hojeISO()
  const [periodo, setPeriodo] = useState<'6' | '12' | 'tudo'>('12')
  const inicioGraf = periodo === 'tudo' ? '2000-01-01' : isoLocal(new Date(new Date().getFullYear(), new Date().getMonth() - (Number(periodo) - 1), 1))

  const ordens = useLista<OrdemResumo>('ordens_resumo', 'select=*&order=data_entrega.asc')
  const itens = useLista<Pick<OrdemItem, 'ordem_id' | 'tipo_peca' | 'tipo_servico' | 'quantidade'>>('ordem_itens', 'select=ordem_id,tipo_peca,tipo_servico,quantidade')
  const clientes = useLista<Pick<Cliente, 'id' | 'bairro' | 'cidade'>>('clientes', 'select=id,bairro,cidade')
  const lanc = useLista<Lancamento>('lancamentos', `data_lancamento=gte.${inicioGraf}&select=id,tipo,status,valor,data_lancamento,cliente_id`)
  const produtos = useLista<Produto>('produtos', 'ativo=eq.true&select=id,nome,estoque_atual,estoque_minimo')
  const comp = useLista<Compromisso>('compromissos', `data_compromisso=eq.${hoje}&order=hora_inicio.asc`)

  const dados = useMemo(() => {
    const abertas = ordens.rows.filter((o) => ordemAberta(o.status))
    const paraHoje = abertas.filter((o) => o.data_entrega === hoje)
    const atrasadas = abertas.filter((o) => o.status !== 'pronta' && o.data_entrega < hoje)
    const prontas = abertas.filter((o) => o.status === 'pronta')
    const devendo = ordens.rows.filter((o) => o.status !== 'cancelada' && Number(o.saldo) > 0)
    const mesIni = hoje.slice(0, 7)
    const entrouMes = lanc.rows.filter((l) => l.tipo === 'entrada' && l.status === 'pago' && l.data_lancamento.startsWith(mesIni)).reduce((s, l) => s + Number(l.valor), 0)
    const saiuMes = lanc.rows.filter((l) => l.tipo === 'saida' && l.status === 'pago' && l.data_lancamento.startsWith(mesIni)).reduce((s, l) => s + Number(l.valor), 0)
    const baixos = produtos.rows.filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo))

    // Gráficos
    const meses: Barra[] = []
    const n = periodo === 'tudo' ? 12 : Number(periodo)
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
      const chave = isoLocal(d).slice(0, 7)
      meses.push({
        rotulo: `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        valor: lanc.rows.filter((l) => l.tipo === 'entrada' && l.status === 'pago' && l.data_lancamento.startsWith(chave)).reduce((s, l) => s + Number(l.valor), 0),
      })
    }
    const ordensPeriodo = ordens.rows.filter((o) => o.status !== 'cancelada' && o.data_recebimento >= inicioGraf)
    const idsPeriodo = new Set(ordensPeriodo.map((o) => o.id))
    const topClientes = agrupar(ordensPeriodo.map((o) => ({ chave: o.cliente_nome, valor: Number(o.valor_total) })), 10)
    const bairros = agrupar(clientes.rows.map((c) => ({ chave: c.bairro?.trim() || 'Sem bairro', valor: 1 })), 10)
    const cidades = agrupar(clientes.rows.map((c) => ({ chave: c.cidade?.trim() || 'Sem cidade', valor: 1 })), 10)
    const itensPeriodo = itens.rows.filter((i) => idsPeriodo.has(i.ordem_id))
    const pecas = agrupar(itensPeriodo.map((i) => ({ chave: i.tipo_peca, valor: Number(i.quantidade) })), 10)
    const servicos = agrupar(itensPeriodo.map((i) => ({ chave: i.tipo_servico, valor: Number(i.quantidade) })), 10)
    return { paraHoje, atrasadas, prontas, devendo, entrouMes, saiuMes, baixos, meses, topClientes, bairros, cidades, pecas, servicos, abertas }
  }, [ordens.rows, itens.rows, clientes.rows, lanc.rows, produtos.rows, hoje, periodo, inicioGraf])

  if (ordens.loading) return <Loading />
  if (ordens.error) return <ErrorState texto={ordens.error} onRetry={ordens.reload} />

  const totalDevendo = dados.devendo.reduce((s, o) => s + Number(o.saldo), 0)
  const semNada = !ordens.rows.length && !clientes.rows.length
  const proximas = dados.abertas.filter((o) => o.data_entrega >= hoje).slice(0, 8)

  return (
    <div className="page">
      <PageHeader
        title={`Olá${user?.fullName ? `, ${primeiroNome(user.fullName)}` : ''}!`}
        sub="Este é o resumo do seu ateliê: o que fazer hoje, quem avisar e como está o dinheiro."
        actions={
          <>
            <Link className="btn btn-primary" to="/app/costuras/nova">
              <Plus size={18} /> Receber costura
            </Link>
            <Link className="btn btn-secondary" to="/app/clientes/nova">
              <UserPlus size={18} /> Nova cliente
            </Link>
          </>
        }
      />

      {semNada ? (
        <div className="alert alert-ok">
          Comece cadastrando sua primeira cliente e depois toque em <strong>Receber costura</strong>. Dúvidas? Abra o{' '}
          <Link to="/app/comece-aqui">Comece Aqui</Link>.
        </div>
      ) : null}

      <div className="kpi-row">
        <KpiCard titulo="Entregar hoje" valor={String(dados.paraHoje.length)} icon={<Shirt size={18} />} tom={dados.paraHoje.length ? 'alerta' : 'neutro'} onClick={() => navigate('/app/agenda')} />
        <KpiCard titulo="Atrasadas" valor={String(dados.atrasadas.length)} icon={<AlertTriangle size={18} />} tom={dados.atrasadas.length ? 'erro' : 'ok'} onClick={() => navigate('/app/costuras')} />
        <KpiCard titulo="Prontas — avisar" valor={String(dados.prontas.length)} icon={<CheckCircle2 size={18} />} tom={dados.prontas.length ? 'ok' : 'neutro'} onClick={() => navigate('/app/mensagens')} />
        <KpiCard titulo="Clientes devendo" valor={moeda(totalDevendo)} icon={<HandCoins size={18} />} tom={totalDevendo ? 'erro' : 'ok'} onClick={() => navigate('/app/pendencias')} />
        <KpiCard titulo="Entrou no mês" valor={moeda(dados.entrouMes)} detalhe={`Saiu ${moeda(dados.saiuMes)}`} icon={<Wallet size={18} />} tom="ok" onClick={() => navigate('/app/caixa')} />
        <KpiCard titulo="Estoque acabando" valor={String(dados.baixos.length)} icon={<Package size={18} />} tom={dados.baixos.length ? 'alerta' : 'ok'} onClick={() => navigate('/app/estoque')} />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">
            <CalendarDays size={18} /> Hoje, {formatDateBR(hoje)}
          </h2>
          {!dados.paraHoje.length && !comp.rows.length ? <p className="page-sub">Nenhuma entrega nem compromisso para hoje.</p> : null}
          <ul className="lista-simples">
            {dados.paraHoje.map((o) => (
              <li key={o.id}>
                <Link to={`/app/costuras/${o.id}`}>
                  {o.hora_entrega ? `${formatHora(o.hora_entrega)} · ` : ''}Entregar {o.cliente_nome} · Nº {o.numero}
                </Link>
                <StatusBadge status={o.status} />
              </li>
            ))}
            {comp.rows.map((c) => (
              <li key={c.id}>
                <Link to="/app/agenda">
                  {c.hora_inicio ? `${formatHora(c.hora_inicio)} · ` : ''}
                  {c.titulo}
                </Link>
                {c.concluido ? <span className="badge badge--ok">Feito</span> : null}
              </li>
            ))}
          </ul>
          {dados.atrasadas.length ? (
            <>
              <h3 className="sub-title txt-erro">Atrasadas</h3>
              <ul className="lista-simples">
                {dados.atrasadas.slice(0, 6).map((o) => (
                  <li key={o.id}>
                    <Link to={`/app/costuras/${o.id}`}>
                      {o.cliente_nome} · Nº {o.numero} · era {formatDateBR(o.data_entrega)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section className="card">
          <h2 className="section-title">
            <Scissors size={18} /> Próximas entregas
          </h2>
          {proximas.length ? (
            <ul className="lista-simples">
              {proximas.map((o) => (
                <li key={o.id}>
                  <Link to={`/app/costuras/${o.id}`}>
                    {formatDateBR(o.data_entrega)} · {o.cliente_nome} · {o.qtd_pecas} peça(s)
                  </Link>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="page-sub">Nenhuma entrega marcada.</p>
          )}
        </section>
      </div>

      <div className="chips">
        <span className="chip-label">Gráficos:</span>
        {(
          [
            ['6', 'Últimos 6 meses'],
            ['12', 'Últimos 12 meses'],
            ['tudo', 'Tudo'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" className={`chip ${periodo === v ? 'chip--ativo' : ''}`} onClick={() => setPeriodo(v)}>
            {l}
          </button>
        ))}
      </div>
      <Colunas titulo="Dinheiro recebido por mês" dados={dados.meses} formatar={moeda} />
      <div className="grid-2">
        <BarrasHorizontais titulo="Top 10 clientes (valor das costuras)" dados={dados.topClientes} formatar={moeda} vazio="Registre costuras para ver suas melhores clientes." />
        <BarrasHorizontais titulo="Peças que mais chegam" dados={dados.pecas} formatar={(n) => `${numeroBR(n)} peça(s)`} vazio="Registre costuras para ver as peças." />
        <BarrasHorizontais titulo="Serviços mais pedidos (ajuste, reforma…)" dados={dados.servicos} formatar={(n) => `${numeroBR(n)} peça(s)`} vazio="Sem serviços ainda." />
        <BarrasHorizontais titulo="De onde são suas clientes — bairro" dados={dados.bairros} formatar={(n) => `${n} cliente(s)`} vazio="Cadastre clientes com bairro." />
        <BarrasHorizontais titulo="De onde são suas clientes — cidade" dados={dados.cidades} formatar={(n) => `${n} cliente(s)`} vazio="Cadastre clientes com cidade." />
      </div>
    </div>
  )
}
