import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isDeveloperAdmin } from '../lib/admin'
import { APP_VERSION, BRAND, linkWhatsAppInteresse, tipoLicenca } from '../lib/brand'
import { formatDateBR, textoRestante } from '../lib/format'
import { useInstallApp } from '../lib/install'
import { applyInstallResult } from '../lib/installFlow'
import { useToast } from '../lib/toast'
import { ChangePasswordPage } from './ChangePassword'
import { AtelieConfig } from '../components/AtelieConfig'

export function ConfigPage() {
  const { user } = useAuth()
  const { install } = useInstallApp()
  const { push } = useToast()
  const location = useLocation()
  const tipo = tipoLicenca(user?.plan, user?.licenseStatus)
  const vitalicia = tipo === 'vitalícia'

  useEffect(() => {
    const hash = location.hash
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  async function onInstall() {
    const result = await install()
    applyInstallResult(result, push)
  }

  return (
    <div className="page">
      <h1 className="page-title">Configurações</h1>
      <p className="page-sub">Conta, licença, senha, instalação, dados do ateliê e modelos de mensagem.</p>

      <div className="config-top">
        <div className="card config-box config-box--compact" id="conta-licenca">
          <h2 className="section-title">Conta e licença</h2>
          <p className="config-meta">
            E-mail: <strong>{user?.email || '—'}</strong>
          </p>
          <p className="config-meta">
            Papel: <strong>{isDeveloperAdmin(user) ? 'Administrador' : 'Usuária'}</strong>
          </p>
          <p className="config-meta">
            Tipo: <strong>{tipo}</strong>
          </p>
          <p className="config-meta">
            Data de aquisição: <strong>{user?.licenseCreatedAt ? formatDateBR(user.licenseCreatedAt) : '—'}</strong>
          </p>
          <p className="config-meta">
            Vencimento:{' '}
            <strong>
              {vitalicia || !user?.licenseExpiresAt
                ? 'Indeterminado'
                : `${formatDateBR(user.licenseExpiresAt)} (${textoRestante(user.licenseExpiresAt)})`}
            </strong>
          </p>
          <p className="config-meta">
            Versão: <strong>v{APP_VERSION}</strong>
          </p>
          {!vitalicia ? (
            <p className="config-meta">
              {BRAND.hotmartUrl !== '#' ? (
                <a href={BRAND.hotmartUrl} target="_blank" rel="noreferrer">
                  Renovar ou fazer upgrade
                </a>
              ) : (
                <a href={linkWhatsAppInteresse()} target="_blank" rel="noreferrer">Falar com o suporte para renovar</a>
              )}
            </p>
          ) : null}
        </div>

        <div id="alterar-senha">
          <ChangePasswordPage embedded />
        </div>

        <div className="card config-box" id="instalar-app">
          <h2 className="section-title">Instalar App</h2>
          <button className="btn btn-primary" type="button" onClick={onInstall}>
            <Download size={16} />
            Instalar App
          </button>
        </div>
      </div>

      <AtelieConfig />

      <div className="card">
        <h2 className="section-title">Mais</h2>
        <p>
          <Link to="/app/termos">Termos de Uso</Link>
          {' · '}
          <Link to="/app/lgpd">Privacidade / LGPD</Link>
        </p>
      </div>
    </div>
  )
}
