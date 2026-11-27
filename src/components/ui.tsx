import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw, X } from 'lucide-react'
import { mascaraMoeda } from '../lib/format'
import { rotuloStatus, tomStatus } from '../lib/costura'

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  )
}

export function Loading({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="state-box" role="status">
      <Loader2 size={22} className="spin" />
      <p>{texto}</p>
    </div>
  )
}

export function ErrorState({ texto, onRetry }: { texto: string; onRetry?: () => void }) {
  return (
    <div className="state-box state-box--erro" role="alert">
      <AlertTriangle size={22} />
      <p>{texto}</p>
      {onRetry ? (
        <button className="btn btn-ghost" type="button" onClick={onRetry}>
          <RefreshCw size={16} /> Tentar de novo
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({ texto, acao }: { texto: string; acao?: ReactNode }) {
  return (
    <div className="state-box">
      <Inbox size={22} />
      <p>{texto}</p>
      {acao}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge--${tomStatus(status)}`}>{rotuloStatus(status)}</span>
}

export function Modal({
  titulo,
  onClose,
  children,
  largo,
}: {
  titulo: string
  onClose: () => void
  children: ReactNode
  largo?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${largo ? 'modal--largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <div className="modal-head">
          <h2>{titulo}</h2>
          <button className="icon-btn icon-btn--claro" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/** Campo de dinheiro com máscara BR (R$ 1.234,56). Guarda o texto; converta com parseMoeda ao salvar. */
export function MoneyInput({
  id,
  value,
  onChange,
  required,
  placeholder = '0,00',
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="money-input">
      <span aria-hidden="true">R$</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(mascaraMoeda(e.target.value))}
      />
    </div>
  )
}

/** Lista de opções que abre (datalist): escolhe na lista ou digita outra. */
export function ListaOpcoes({ id, opcoes }: { id: string; opcoes: string[] }) {
  return (
    <datalist id={id}>
      {[...opcoes].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  )
}

export function Field({ label, htmlFor, children, dica }: { label: string; htmlFor?: string; children: ReactNode; dica?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {dica ? <small className="field-hint">{dica}</small> : null}
    </div>
  )
}

export function KpiCard({
  titulo,
  valor,
  detalhe,
  icon,
  tom = 'neutro',
  onClick,
}: {
  titulo: string
  valor: string
  detalhe?: string
  icon?: ReactNode
  tom?: 'neutro' | 'ok' | 'alerta' | 'erro'
  onClick?: () => void
}) {
  const conteudo = (
    <>
      <div className="kpi-top">
        {icon}
        <span>{titulo}</span>
      </div>
      <strong className="kpi-valor">{valor}</strong>
      {detalhe ? <small>{detalhe}</small> : null}
    </>
  )
  return onClick ? (
    <button type="button" className={`kpi kpi--${tom} kpi--click`} onClick={onClick}>
      {conteudo}
    </button>
  ) : (
    <div className={`kpi kpi--${tom}`}>{conteudo}</div>
  )
}
