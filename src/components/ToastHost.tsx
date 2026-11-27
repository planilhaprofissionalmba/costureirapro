import { useToast } from '../lib/toast'

export function ToastHost() {
  const { toasts, dismiss } = useToast()
  if (!toasts.length) return null
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.message}</span>
          {t.sticky ? (
            <button className="toast-close" type="button" aria-label="Fechar aviso" onClick={() => dismiss(t.id)}>
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
