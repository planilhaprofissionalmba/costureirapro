/** Datas "AAAA-MM-DD" (sem hora) são lidas como data local — evita voltar 1 dia no fuso de Cuiabá. */
function parseData(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function formatDateBR(value?: string | null): string {
  if (!value) return '—'
  const d = parseData(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function formatDateTimeBR(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDiaSemana(value: string): string {
  const d = parseData(value)
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

export function formatHora(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 5)
}

/** Hoje em AAAA-MM-DD (data local). */
export function hojeISO(): string {
  return isoLocal(new Date())
}

export function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function somarDias(iso: string, dias: number): string {
  const d = parseData(iso)
  d.setDate(d.getDate() + dias)
  return isoLocal(d)
}

/** Diferença em dias (b − a) entre duas datas AAAA-MM-DD. */
export function diasEntre(a: string, b: string): number {
  return Math.round((parseData(b).getTime() - parseData(a).getTime()) / 86400000)
}

export function textoRestante(value?: string | null): string {
  const dias = daysUntil(value)
  if (dias === null) return ''
  if (dias < 0 || (value && new Date(value).getTime() <= Date.now())) return 'vencida'
  if (dias <= 1) return 'vence hoje'
  return `faltam ${dias} dias`
}

export function daysUntil(value?: string | null): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(valor?: number | string | null): string {
  const n = Number(valor || 0)
  return BRL.format(Number.isFinite(n) ? n : 0)
}

/** "1.234,56" → 1234.56 · aceita também "1234.56". */
export function parseMoeda(texto: string): number {
  const limpo = String(texto || '').replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normal)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/** Máscara de moeda ao digitar: só números, 2 casas. */
export function mascaraMoeda(texto: string): string {
  const digitos = String(texto || '').replace(/\D/g, '').slice(0, 12)
  if (!digitos) return ''
  const n = Number(digitos) / 100
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function numeroBR(valor: number, casas = 0): string {
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function percent(valor: number): string {
  return `${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function soDigitos(texto?: string | null): string {
  return String(texto || '').replace(/\D/g, '')
}

export function mascaraTelefone(texto?: string | null): string {
  let d = soDigitos(texto)
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  d = d.slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function mascaraCpf(texto?: string | null): string {
  const d = soDigitos(texto).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function mascaraCep(texto?: string | null): string {
  const d = soDigitos(texto).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Validação oficial dos dígitos verificadores do CPF. */
export function cpfValido(texto?: string | null): boolean {
  const cpf = soDigitos(texto)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = calc(cpf.slice(0, 9), 10)
  const d2 = calc(cpf.slice(0, 10), 11)
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10])
}

/** Telefone para o link do WhatsApp: 55 + DDD + número. */
export function telefoneWhatsApp(texto?: string | null): string {
  let d = soDigitos(texto)
  if (!d) return ''
  if (d.startsWith('0')) d = d.replace(/^0+/, '')
  if (d.length === 10 || d.length === 11) d = `55${d}`
  return d
}

export function primeiroNome(nome?: string | null): string {
  return String(nome || '').trim().split(/\s+/)[0] || ''
}

export function compararNome(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}
