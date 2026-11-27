import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function ProtectedRoute() {
  const { user, loading, isFirstAccess, sessionExpired } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="center-page">
        <div className="loading-state">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location, expired: sessionExpired }} />
  }

  if (!user.termsAcceptedAt) {
    return <Navigate to="/login" replace state={{ needTerms: true }} />
  }

  // Só no 1º painel: força Comece Aqui. Depois o usuário pode abrir o manual pelo menu.
  if (
    isFirstAccess &&
    !location.pathname.includes('comece-aqui') &&
    !location.pathname.includes('termos') &&
    !location.pathname.includes('lgpd')
  ) {
    return <Navigate to="/app/comece-aqui" replace />
  }

  return <Outlet />
}
