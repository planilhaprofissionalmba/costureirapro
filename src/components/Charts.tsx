import { useState } from 'react'

/**
 * Gráficos simples de uma série (sem legenda: o título nomeia a série).
 * Barra fina na cor primária, rótulo e valor em texto (nunca só cor), dica ao passar o dedo/mouse,
 * e tabela equivalente para leitura acessível.
 */

export type Barra = { rotulo: string; valor: number; detalhe?: string }

export function BarrasHorizontais({
  titulo,
  dados,
  formatar = (n) => String(n),
  vazio = 'Sem dados ainda.',
}: {
  titulo: string
  dados: Barra[]
  formatar?: (n: number) => string
  vazio?: string
}) {
  const max = Math.max(...dados.map((d) => d.valor), 0)
  const [verTabela, setVerTabela] = useState(false)
  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2 className="section-title">{titulo}</h2>
        {dados.length ? (
          <button className="linkish" type="button" onClick={() => setVerTabela((v) => !v)}>
            {verTabela ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        ) : null}
      </div>
      {!dados.length ? (
        <p className="page-sub">{vazio}</p>
      ) : verTabela ? (
        <table className="chart-tabela">
          <tbody>
            {dados.map((d) => (
              <tr key={d.rotulo}>
                <th scope="row">{d.rotulo}</th>
                <td>{formatar(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="hbars" aria-label={titulo}>
          {dados.map((d) => (
            <li key={d.rotulo} className="hbar" title={`${d.rotulo}: ${formatar(d.valor)}${d.detalhe ? ` · ${d.detalhe}` : ''}`}>
              <span className="hbar-rotulo">{d.rotulo}</span>
              <span className="hbar-trilho">
                <span className="hbar-barra" style={{ width: `${max ? Math.max((d.valor / max) * 100, 2) : 0}%` }} />
              </span>
              <span className="hbar-valor">{formatar(d.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Colunas({
  titulo,
  dados,
  formatar = (n) => String(n),
}: {
  titulo: string
  dados: Barra[]
  formatar?: (n: number) => string
}) {
  const max = Math.max(...dados.map((d) => d.valor), 0)
  const [foco, setFoco] = useState<number | null>(null)
  return (
    <section className="card chart-card">
      <h2 className="section-title">{titulo}</h2>
      <div className="vbars" role="img" aria-label={`${titulo}: ${dados.map((d) => `${d.rotulo} ${formatar(d.valor)}`).join(', ')}`}>
        {dados.map((d, i) => (
          <button
            key={d.rotulo}
            type="button"
            className={`vbar ${foco === i ? 'vbar--foco' : ''}`}
            onMouseEnter={() => setFoco(i)}
            onMouseLeave={() => setFoco(null)}
            onFocus={() => setFoco(i)}
            onBlur={() => setFoco(null)}
            onClick={() => setFoco(foco === i ? null : i)}
            aria-label={`${d.rotulo}: ${formatar(d.valor)}`}
          >
            {foco === i ? <span className="vbar-dica">{formatar(d.valor)}</span> : null}
            <span className="vbar-area">
              <span className="vbar-barra" style={{ height: `${max ? Math.max((d.valor / max) * 100, d.valor ? 3 : 0) : 0}%` }} />
            </span>
            <span className="vbar-rotulo">{d.rotulo}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
