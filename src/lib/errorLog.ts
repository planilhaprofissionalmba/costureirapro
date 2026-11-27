import { callAuth } from './api'

/** Grava erro amigável em costureirapro.error_logs (sem senha / sem stack para o cliente). */
export async function logClientError(screen: string, message: string, token?: string | null) {
  const clean = String(message || 'erro')
    .replace(/(password|senha|token|hash)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 500)
  await callAuth('log_error', {
    screen: String(screen || 'app').slice(0, 120),
    message: clean,
    token: token || undefined,
  })
}
