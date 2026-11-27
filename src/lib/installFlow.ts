import type { InstallResult } from './install'
import type { ToastKind } from './toast'

type Push = (kind: ToastKind, message: string) => void

/**
 * Resultado do Instalar App (Prompt V3.31): instala pela oferta nativa ao clicar.
 * Onde o navegador não permite instalar por botão, só um aviso curto — sem janela de orientação.
 */
export function applyInstallResult(
  result: InstallResult,
  push: Push,
) {
  if (result === 'ok') return
  if (result === 'installed') {
    push('ok', 'Este app já está instalado neste aparelho.')
    return
  }
  if (result === 'ios') {
    push('warn', 'No iPhone e no iPad, a Apple não permite instalar por botão.')
    return
  }
  push('warn', 'Este navegador não permite instalar por botão. Abra no Chrome ou no Edge.')
}
