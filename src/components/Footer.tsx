import { APP_NAME, BRAND, linkWhatsAppInteresse } from '../lib/brand'

type FooterProps = {
  tone?: 'light' | 'dark'
  /** Mantido por compatibilidade: o rodapé é sempre 1 linha. */
  compact?: boolean
  interesse?: boolean
}

export function Footer({ tone = 'light', compact: _compact = true, interesse = false }: FooterProps) {
  const whatsappHref = interesse
    ? linkWhatsAppInteresse(APP_NAME)
    : `https://wa.me/${BRAND.whatsapp.replace('+', '')}`

  return (
    <footer className={`app-footer app-footer--${tone} app-footer--oneline`}>
      <p className="app-footer-line">
        <a href={BRAND.site} target="_blank" rel="noreferrer">
          Desenvolvido por planilhaprofissional.com
        </a>
        {' · '}
        <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        {' · '}
        <a href={whatsappHref} target="_blank" rel="noreferrer">
          WhatsApp {BRAND.whatsappDisplay}
        </a>
      </p>
    </footer>
  )
}
