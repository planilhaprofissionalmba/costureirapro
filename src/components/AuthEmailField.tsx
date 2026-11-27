import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { filterRecentEmails, loadRecentEmails, saveRecentEmail } from '../lib/recentEmails'

type Props = {
  inputRef: RefObject<HTMLInputElement | null>
  id: string
  name?: string
  placeholder?: string
  /** true = lista própria de e-mails recentes (padrão Prompt V2.65). */
  persist?: boolean
}

/** Define o value no DOM de um jeito que Chrome e Edge aceitam. */
function setInputValue(el: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  proto?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function sameList(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((item, i) => item === b[i])
}

/**
 * Campo de e-mail com lista própria (Chrome/Edge).
 * Campo começa vazio (defaultValue); ao focar/digitar sugere recentes.
 * Sem recentes no localStorage, deixa o autofill nativo (username).
 * autoComplete fica FIXO no mount — trocar no meio faz o Chrome reescrever a senha.
 */
export function AuthEmailField({
  inputRef,
  id,
  name = 'email',
  placeholder = 'Digite seu e-mail',
  persist = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => (persist ? loadRecentEmails() : []))
  // Trava no 1º paint: mudar username↔off no meio da tela faz o cofre alterar a senha sozinho.
  const [ac] = useState(() => {
    if (!persist) return 'username'
    return loadRecentEmails().length > 0 ? 'off' : 'username'
  })

  function refreshRecent() {
    if (!persist) {
      setRecent((prev) => (prev.length === 0 ? prev : []))
      return [] as string[]
    }
    const list = loadRecentEmails()
    setRecent((prev) => (sameList(prev, list) ? prev : list))
    return list
  }

  useEffect(() => {
    if (persist) refreshRecent()
    else setRecent([])
  }, [persist, inputRef])

  // Captura preenchimento do cofre do Chrome/Edge (sem digitar).
  useEffect(() => {
    if (!persist) return
    const el = inputRef.current
    if (!el) return

    const pull = () => {
      const v = el.value.trim()
      setQuery((prev) => (prev === v ? prev : v))
      if (v.includes('@') && v.includes('.')) {
        saveRecentEmail(v)
        refreshRecent()
      }
    }

    el.addEventListener('input', pull)
    el.addEventListener('change', pull)
    el.addEventListener('animationstart', pull)

    // Poucas leituras só para pegar autofill atrasado — sem setState a cada tick.
    const timer = window.setInterval(pull, 500)
    const stop = window.setTimeout(() => window.clearInterval(timer), 2500)

    return () => {
      el.removeEventListener('input', pull)
      el.removeEventListener('change', pull)
      el.removeEventListener('animationstart', pull)
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [inputRef, persist])

  useEffect(() => {
    function onDocDown(e: Event) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [])

  const suggestions = persist ? filterRecentEmails(query, recent) : []

  function pullQuery() {
    const v = inputRef.current?.value || ''
    setQuery((prev) => (prev === v ? prev : v))
    return v
  }

  function pick(email: string) {
    if (!persist) return
    const el = inputRef.current
    if (el) {
      setInputValue(el, email)
      el.focus()
    }
    saveRecentEmail(email)
    setQuery(email)
    refreshRecent()
    setOpen(false)
  }

  function onPickPointer(e: ReactPointerEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>, email: string) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.nativeEvent as Event).stopImmediatePropagation?.()
    pick(email)
  }

  return (
    <div className="auth-field auth-field--email" ref={wrapRef}>
      <label className="field-label" htmlFor={id}>
        E-mail
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="email"
        required
        autoComplete={ac}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="email"
        placeholder={placeholder}
        defaultValue=""
        onFocus={() => {
          const list = refreshRecent()
          pullQuery()
          if (persist && list.length > 0) setOpen(true)
        }}
        onInput={() => {
          pullQuery()
          if (persist) setOpen(true)
        }}
        onClick={() => {
          const list = refreshRecent()
          if (persist && list.length > 0) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!persist || !open || suggestions.length === 0) return
          if (e.key === 'Escape') {
            setOpen(false)
            return
          }
          if (e.key === 'Enter' && suggestions.length === 1 && query !== suggestions[0]) {
            const full = suggestions[0]
            if (full.startsWith(query.toLowerCase()) && query.length >= 3) {
              e.preventDefault()
              pick(full)
            }
          }
        }}
        onBlur={() => {
          if (!persist) return
          const v = (inputRef.current?.value || '').trim().toLowerCase()
          if (v.includes('@')) {
            saveRecentEmail(v)
            refreshRecent()
          }
        }}
      />
      {persist && open && suggestions.length > 0 ? (
        <ul className="auth-email-suggest" role="listbox">
          {suggestions.map((email) => (
            <li key={email} role="option">
              <button
                type="button"
                className="auth-email-suggest-item"
                onPointerDown={(e) => onPickPointer(e, email)}
                onMouseDown={(e) => onPickPointer(e, email)}
              >
                {email}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
