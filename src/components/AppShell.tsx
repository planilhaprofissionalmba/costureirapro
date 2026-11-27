import { useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu,
  X,
  LogOut,
  KeyRound,
  Download,
  Settings,
  BookOpen,
  ScrollText,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  CalendarDays,
  Scissors,
  Users,
  Package,
  ShoppingCart,
  Wallet,
  HandCoins,
  MessageCircle,
  Tags,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isDeveloperAdmin } from '../lib/admin'
import { APP_NAME, APP_SLOGAN, BRAND, tipoLicenca } from '../lib/brand'
import { daysUntil, formatDateBR, textoRestante } from '../lib/format'
import { useInstallApp } from '../lib/install'
import { applyInstallResult } from '../lib/installFlow'
import { useToast } from '../lib/toast'
import { BrandLockup } from './BrandLockup'
import { Footer } from './Footer'

// Hover do menu: computador (≥ 1024 px) ou qualquer tela com mouse de verdade
const DESKTOP_MQ = '(min-width: 1024px), (hover: hover) and (pointer: fine)'

type NavItem = {
  to: string
  /** Link externo (abre em nova aba) no lugar da rota interna. */
  href?: string
  label: string
  icon: ComponentType<{ size?: number }>
  badge?: string
}

type NavSection = { label: string; items: NavItem[] }

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const onChange = () => setDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const isDesktop = useIsDesktop()
  const closeTimer = useRef<number | null>(null)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { push } = useToast()
  const { install } = useInstallApp()
  const vitalicia = tipoLicenca(user?.plan, user?.licenseStatus) === 'vitalícia'
  const daysLeft = daysUntil(user?.licenseExpiresAt)
  // D11: em trial o aviso fica sempre visível com os dias restantes; nos outros planos, só nos 3 últimos dias
  const emTrial = user?.licenseStatus === 'trial' && Boolean(user?.licenseExpiresAt)
  const showExpiry = !vitalicia && user?.licenseExpiresAt && daysLeft !== null && (emTrial || daysLeft <= 3)
  const isAdmin = isDeveloperAdmin(user)

  const sections: NavSection[] = [
    {
      label: 'VISÃO GERAL',
      items: [
        { to: '/app/comece-aqui', label: 'Comece Aqui', icon: BookOpen, badge: 'INÍCIO' },
        { to: '/app/dashboard', label: 'Painel (resumo)', icon: LayoutDashboard },
      ],
    },
    {
      label: 'ATELIÊ',
      items: [
        { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
        { to: '/app/costuras', label: 'Costuras', icon: Scissors },
        { to: '/app/clientes', label: 'Clientes', icon: Users },
        { to: '/app/mensagens', label: 'Mensagens WhatsApp', icon: MessageCircle },
        { to: '/app/servicos', label: 'Tabela de preços', icon: Tags },
      ],
    },
    {
      label: 'MATERIAIS',
      items: [
        { to: '/app/estoque', label: 'Estoque', icon: Package },
        { to: '/app/compras', label: 'Compras', icon: ShoppingCart },
      ],
    },
    {
      label: 'DINHEIRO',
      items: [
        { to: '/app/caixa', label: 'Caixa', icon: Wallet },
        { to: '/app/pendencias', label: 'Pendências', icon: HandCoins },
      ],
    },
    {
      label: 'CONTA',
      items: [
        { to: '/app/config#alterar-senha', label: 'Alterar Senha', icon: KeyRound },
        { to: '/app/config', label: 'Configurações', icon: Settings },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'ADMINISTRAÇÃO',
            items: [{ to: '/app/admin', label: 'Administração de acessos', icon: ShieldCheck }],
          } satisfies NavSection,
        ]
      : []),
    {
      label: 'DOCUMENTOS',
      items: [
        { to: '/app/termos', label: 'Termos de Uso', icon: ScrollText },
        { to: '/app/lgpd', label: 'Privacidade / LGPD', icon: Shield },
      ],
    },
    {
      label: 'APP',
      items: [],
    },
  ]

  function clearCloseTimer() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function openMenu() {
    clearCloseTimer()
    setOpen(true)
  }

  function scheduleClose() {
    if (!isDesktop) return
    clearCloseTimer()
    closeTimer.current = window.setTimeout(() => setOpen(false), 280)
  }

  useEffect(() => () => clearCloseTimer(), [])
  useEffect(() => {
    if (!isDesktop) return
    setOpen(false)
  }, [isDesktop, location.pathname])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function onLogout() {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  async function onInstall() {
    const result = await install()
    applyInstallResult(result, push)
  }

  function linkClass(to: string, isActive: boolean) {
    const hashTarget = to.includes('#') ? to.split('#')[1] : null
    if (hashTarget) {
      return location.pathname === '/app/config' && location.hash === `#${hashTarget}` ? 'active' : undefined
    }
    if (to === '/app/config') {
      return location.pathname === '/app/config' && location.hash !== '#alterar-senha' ? 'active' : undefined
    }
    return isActive ? 'active' : undefined
  }

  const drawerVisible = open
  const accountName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Conta'

  return (
    <div className="shell">
      <header className="shell-header">
        <button
          className="icon-btn"
          type="button"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => {
            if (isDesktop) openMenu()
          }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div
          className="topbar-menu-hint"
          aria-hidden="true"
          onMouseEnter={() => {
            if (isDesktop) openMenu()
          }}
        >
          <strong>MENU</strong>
          <span>Toque no ícone ☰ para navegar</span>
        </div>
        <div className="shell-header-brand">
          <img
            src="/app-icon.png"
            alt=""
            className="shell-header-icon"
            width={44}
            height={44}
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/app-icon.svg'
            }}
          />
          <div className="shell-header-text">
            <h1>{APP_NAME}</h1>
            <p className="shell-header-slogan">{APP_SLOGAN}</p>
          </div>
        </div>
      </header>

      {isDesktop ? (
        <div
          className="drawer-hotzone"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          aria-hidden="true"
        />
      ) : null}

      {drawerVisible ? (
        <>
          {!isDesktop ? <div className="drawer-backdrop" onClick={() => setOpen(false)} /> : null}
          <aside
            className="drawer"
            role="navigation"
            aria-label="Menu"
            onMouseEnter={() => {
              if (isDesktop) openMenu()
            }}
            onMouseLeave={scheduleClose}
          >
            <div className="drawer-brand">
              <div className="drawer-brand-top">
                <BrandLockup tone="dark" subtitle={APP_SLOGAN} />
                <button className="icon-btn drawer-close" type="button" aria-label="Fechar" onClick={() => setOpen(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="drawer-account">
              <p className="drawer-account-name">{accountName}</p>
              <p className="drawer-account-email">{user?.email || '—'}</p>
            </div>

            <div className="drawer-scroll">
              <nav>
                {sections.map((section) => (
                  <div key={section.label}>
                    <div className="section-label">{section.label}</div>
                    {section.items.map((l) => {
                      const Icon = l.icon
                      if (l.href) {
                        return (
                          <a key={l.to} href={l.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                            <Icon size={16} />
                            <span>{l.label}</span>
                          </a>
                        )
                      }
                      return (
                        <NavLink
                          key={l.to}
                          to={l.to}
                          className={({ isActive }) => linkClass(l.to, isActive)}
                          onClick={() => setOpen(false)}
                        >
                          <Icon size={16} />
                          <span>{l.label}</span>
                          {l.badge ? <span className="nav-badge">{l.badge}</span> : null}
                        </NavLink>
                      )
                    })}
                    {section.label === 'APP' ? (
                      <button className="nav-link" type="button" onClick={onInstall}>
                        <Download size={16} />
                        <span>Instalar App</span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>

            <div className="drawer-footer">
              <button className="btn-sair" type="button" onClick={onLogout}>
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <main className="shell-main">
        {showExpiry && (
          <div className="alert alert-warn">
            {emTrial
              ? `Período de teste: ${textoRestante(user?.licenseExpiresAt)} (até ${formatDateBR(user?.licenseExpiresAt)}).`
              : `Seu plano vence em ${daysLeft} dia(s).`}{' '}
            {BRAND.hotmartUrl !== '#' ? (
              <a href={BRAND.hotmartUrl} target="_blank" rel="noreferrer">
                Renovar agora
              </a>
            ) : (
              <a href={`mailto:${BRAND.supportEmail}`}>Fale com o suporte para renovar.</a>
            )}
          </div>
        )}
        {user?.termsAcceptedAt || location.pathname.includes('termos') || location.pathname.includes('lgpd') ? (
          <Outlet />
        ) : (
          <Navigate to="/login" replace state={{ needTerms: true }} />
        )}
      </main>
      <Footer compact />
    </div>
  )
}
