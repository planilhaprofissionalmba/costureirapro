import { forwardRef, useRef, useState, type ChangeEvent, type ClipboardEvent, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { normalizePassword } from '../lib/password'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Campo de senha com olho.
 * O type fica no DOM (ref), não no JSX — se o React re-renderizar com type novo,
 * o Chrome/Edge costuma reescrever a senha sozinho.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  props,
  ref,
) {
  const [visible, setVisible] = useState(false)
  const localRef = useRef<HTMLInputElement | null>(null)

  function setRefs(node: HTMLInputElement | null) {
    localRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    props.onPaste?.(e)
    if (e.defaultPrevented) return
    const text = e.clipboardData.getData('text')
    if (!text) return
    const clean = normalizePassword(text)
    if (clean === text) return
    e.preventDefault()
    const el = e.currentTarget
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    proto?.set?.call(el, clean)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    if (props.onChange) {
      props.onChange({ target: el, currentTarget: el } as ChangeEvent<HTMLInputElement>)
    }
  }

  function toggleVisible() {
    setVisible((v) => !v)
  }

  return (
    <span className="password-field">
      <input
        {...props}
        ref={setRefs}
        type={visible ? 'text' : 'password'}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onPaste={onPaste}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={toggleVisible}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
      </button>
    </span>
  )
})
