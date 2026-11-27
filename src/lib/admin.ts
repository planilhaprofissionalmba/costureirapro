import type { SessionUser } from './types'

/**
 * Esconde o menu/rota da Administração. A lista de administradores mora só no servidor
 * (costureirapro.factory_admins + ADMIN_EMAILS) e a Edge valida de novo em TODA ação (403).
 * Esconder o menu não é segurança.
 */
export function isDeveloperAdmin(user?: SessionUser | null): boolean {
  return user?.isAdmin === true
}
