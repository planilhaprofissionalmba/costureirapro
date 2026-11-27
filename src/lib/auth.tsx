import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { callAuth } from './api'
import type { SessionUser } from './types'

const STORAGE_KEY = 'costureirapro_session'
const ACTIVITY_KEY = 'costureirapro_last_activity'
const FIRST_ACCESS_KEY = 'costureirapro_first_access_done'
const IDLE_MS = 30 * 60 * 1000
/** Renovação no servidor durante uso real: no máximo 1 vez a cada 5 min (V3.36). */
const TOUCH_EVERY_MS = 5 * 60 * 1000
export const SESSAO_EXPIRADA_EVENT = 'costureirapro:sessao-expirada'

function onboardingKey(accountId?: string | null) {
  return accountId ? `${FIRST_ACCESS_KEY}:${accountId}` : FIRST_ACCESS_KEY
}

export function isOnboardingDone(accountId?: string | null): boolean {
  try {
    if (accountId) return localStorage.getItem(onboardingKey(accountId)) === '1'
    return localStorage.getItem(FIRST_ACCESS_KEY) === '1'
  } catch {
    return false
  }
}

export function persistOnboardingDone(accountId?: string | null) {
  try {
    localStorage.setItem(FIRST_ACCESS_KEY, '1')
    if (accountId) localStorage.setItem(onboardingKey(accountId), '1')
  } catch {
    /* modo privado */
  }
}

type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  isFirstAccess: boolean
  appHomePath: '/app/comece-aqui' | '/app/dashboard'
  sessionExpired: boolean
  markFirstAccessDone: () => void
  clearSessionExpired: () => void
  completeSession: (token: string) => Promise<string | null>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>
  acceptTerms: () => Promise<string | null>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStored(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function storedToken(): string {
  return loadStored()?.accessToken || ''
}

function mapUser(raw: Record<string, unknown>, token: string): SessionUser {
  return {
    accountId: String(raw.account_id || ''),
    email: String(raw.email || ''),
    fullName: (raw.full_name as string) || null,
    role: (raw.role as string) || null,
    isAdmin: raw.is_admin === true,
    termsAcceptedAt: (raw.terms_accepted_at as string) || null,
    passwordChangedAt: (raw.password_changed_at as string) || null,
    licenseStatus: (raw.license_status as string) || null,
    plan: (raw.license_plan as string) || null,
    licenseExpiresAt: (raw.license_expires_at as string) || null,
    licenseCreatedAt: (raw.license_created_at as string) || null,
    accessToken: token,
  }
}

function readLastActivity(): number {
  return Number(localStorage.getItem(ACTIVITY_KEY) || 0)
}

function isIdleExpired(last = readLastActivity()): boolean {
  if (!last) return true
  return Date.now() - last > IDLE_MS
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFirstAccess, setIsFirstAccess] = useState(() => !isOnboardingDone())
  const [sessionExpired, setSessionExpired] = useState(false)

  const syncFirstAccess = useCallback((accountId?: string | null) => {
    const pending = !isOnboardingDone(accountId)
    setIsFirstAccess(pending)
    return pending
  }, [])

  const persist = useCallback(
    (session: SessionUser | null, opts?: { touchActivity?: boolean }) => {
      if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
        if (opts?.touchActivity !== false) localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
        else if (!localStorage.getItem(ACTIVITY_KEY)) localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
        syncFirstAccess(session.accountId)
      } else {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(ACTIVITY_KEY)
      }
      setUser(session)
    },
    [syncFirstAccess],
  )

  const expireIdle = useCallback(async () => {
    const token = storedToken()
    if (token) {
      try {
        await callAuth('logout', { token })
      } catch {
        /* sessão local encerra mesmo assim */
      }
    }
    persist(null)
    setSessionExpired(true)
  }, [persist])

  const logout = useCallback(async () => {
    const token = storedToken()
    if (token) await callAuth('logout', { token })
    persist(null)
  }, [persist])

  // Revalida no servidor ao abrir (F5 não renova o relógio de inatividade).
  useEffect(() => {
    const stored = loadStored()
    syncFirstAccess(stored?.accountId)
    if (stored && isIdleExpired()) {
      void expireIdle().finally(() => setLoading(false))
      return
    }
    if (!stored?.accessToken) {
      setLoading(false)
      return
    }
    void callAuth('me', { token: stored.accessToken })
      .then((data) => {
        if (data.error || !data.user) {
          persist(null)
          if (data.status === 401) setSessionExpired(true)
          return
        }
        persist(mapUser(data.user as Record<string, unknown>, stored.accessToken), { touchActivity: false })
      })
      .catch(() => persist(null))
      .finally(() => setLoading(false))
  }, [persist, expireIdle, syncFirstAccess])

  // Timeout de 30 min: SEMPRE checa o idle antes de renovar (erro já feito no PrdPro — não repetir).
  useEffect(() => {
    if (!user) return
    let lastTouch = Date.now()
    const checkIdle = () => {
      if (isIdleExpired()) void expireIdle()
    }
    const onActivity = () => {
      if (isIdleExpired()) {
        void expireIdle()
        return
      }
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
      if (Date.now() - lastTouch < TOUCH_EVERY_MS) return
      lastTouch = Date.now()
      const token = storedToken()
      if (token) {
        void callAuth('touch', { token }).then((data) => {
          if (data.status === 401) void expireIdle()
        })
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkIdle()
    }
    const onExpired = () => void expireIdle()
    const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', checkIdle)
    window.addEventListener(SESSAO_EXPIRADA_EVENT, onExpired)
    const timer = window.setInterval(checkIdle, 15000)
    checkIdle()
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', checkIdle)
      window.removeEventListener(SESSAO_EXPIRADA_EVENT, onExpired)
      window.clearInterval(timer)
    }
  }, [user, expireIdle])

  const markFirstAccessDone = useCallback(() => {
    persistOnboardingDone(loadStored()?.accountId || user?.accountId)
    setIsFirstAccess(false)
  }, [user?.accountId])

  const refreshMe = useCallback(async () => {
    const token = storedToken()
    if (!token) return
    if (isIdleExpired()) {
      await expireIdle()
      return
    }
    const data = await callAuth('me', { token })
    if (data.error || !data.user) {
      persist(null)
      return
    }
    persist(mapUser(data.user as Record<string, unknown>, token), { touchActivity: false })
  }, [persist, expireIdle])

  const completeSession = useCallback(
    async (token: string): Promise<string | null> => {
      const me = await callAuth('me', { token })
      if (me.error || !me.user) return String(me.error || 'Sessão inválida.')
      persist(mapUser(me.user as Record<string, unknown>, token))
      setSessionExpired(false)
      return null
    },
    [persist],
  )

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const token = storedToken()
    if (!token) return 'Sessão inválida.'
    const data = await callAuth('change_password', { token, currentPassword, newPassword })
    return data.error ? String(data.error) : null
  }, [])

  const acceptTerms = useCallback(async () => {
    const token = storedToken()
    if (!token) return 'Sessão inválida.'
    const data = await callAuth('accept_terms', { token })
    if (data.error) return String(data.error)
    await refreshMe()
    return null
  }, [refreshMe])

  const appHomePath = isFirstAccess ? '/app/comece-aqui' : '/app/dashboard'

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirstAccess,
        appHomePath,
        sessionExpired,
        markFirstAccessDone,
        clearSessionExpired: () => setSessionExpired(false),
        completeSession,
        logout,
        changePassword,
        acceptTerms,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
