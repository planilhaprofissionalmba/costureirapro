export const APP_NAME = 'CostureiraPro'
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
export const APP_SCHEMA = 'costureirapro' as const
export const APP_SLUG = 'costureirapro' as const
export const APP_SLOGAN = 'Agenda, costuras, clientes e caixa do seu ateliê'
export const APP_URL = 'https://costureirapro.planilhaprofissional.com'

export const BRAND = {
  site: 'https://planilhaprofissional.com',
  supportEmail: 'suporte@planilhaprofissional.com',
  whatsapp: '+5566992388026',
  whatsappDisplay: '+55 66 99238-8026',
  hotmartUrl: import.meta.env.VITE_HOTMART_URL || '#',
  supabaseHubId: 'cqirovvxtyreuvucosol',
} as const

/** Publicação dos textos de Termos e LGPD. */
export const TEXTOS_LEGAIS_ATUALIZADOS = { ano: 2026, mesAno: 'novembro de 2026' } as const

/** Frase de efeito da fábrica (texto fixo · §5). */
export const FACTORY_PITCH = {
  name: 'Planilha Profissional',
  tagline: 'Soluções Digitais Inteligentes',
  line1: 'Você apresenta a necessidade!',
  line2: 'Nós encontramos a solução.',
} as const

export const YOUTUBE_COMECE_AQUI = import.meta.env.VITE_YOUTUBE_COMECE_AQUI || ''
export const YOUTUBE_LANDING = import.meta.env.VITE_YOUTUBE_LANDING || import.meta.env.VITE_YOUTUBE_COMECE_AQUI || ''

/** Modelo comercial HOTMART: De R$ 427 por R$ 347 no lançamento. */
export const PRECO = {
  lancamento: 347,
  depois: 427,
  lancamentoLabel: 'R$ 347,00',
  depoisLabel: 'R$ 427,00',
} as const

function numeroFabrica() {
  return BRAND.whatsapp.replace('+', '')
}

export function linkWhatsAppInteresse(nomeApp: string = APP_NAME): string {
  const texto = `Olá! Tenho interesse no produto ${nomeApp} da Planilha Profissional.`
  return `https://wa.me/${numeroFabrica()}?text=${encodeURIComponent(texto)}`
}

/** Teste grátis de 7 dias (regra 61) — liberação manual: Administração → Trial 7 dias. */
export function linkWhatsAppTeste(nomeApp: string = APP_NAME): string {
  const texto = `Olá! Quero testar o ${nomeApp} grátis por 7 dias. Meu e-mail é: `
  return `https://wa.me/${numeroFabrica()}?text=${encodeURIComponent(texto)}`
}

/** Enquanto o checkout Hotmart não existe, "Comprar/Adquirir" abre o WhatsApp de interesse. */
export function linkCompra(): string {
  return BRAND.hotmartUrl !== '#' ? BRAND.hotmartUrl : linkWhatsAppInteresse()
}

export function tipoLicenca(plan?: string | null, status?: string | null): string {
  if (/vital/i.test(plan || '')) return 'vitalícia'
  if (status === 'trial' || /teste|trial/i.test(plan || '')) return 'teste'
  if (/vencimento/i.test(plan || '')) return 'com vencimento'
  return plan || '—'
}
