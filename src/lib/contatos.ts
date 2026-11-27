/** Importar contato do celular para o cadastro de cliente (sem guardar nada fora do app). */

export type ContatoImportado = {
  nome?: string
  telefone?: string
  email?: string
  endereco?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}

type ContactAddress = { addressLine?: string[]; city?: string; region?: string; postalCode?: string; dependentLocality?: string }
type ContactInfo = { name?: string[]; tel?: string[]; email?: string[]; address?: ContactAddress[] }
type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<ContactInfo[]>
  getProperties?: () => Promise<string[]>
}

function gerenciador(): ContactsManager | null {
  const nav = navigator as Navigator & { contacts?: ContactsManager }
  return nav.contacts && typeof nav.contacts.select === 'function' ? nav.contacts : null
}

/** Android (Chrome): abre a agenda do celular — os mesmos contatos que aparecem no WhatsApp. */
export function podeAbrirAgenda(): boolean {
  return Boolean(gerenciador())
}

export async function escolherDaAgenda(): Promise<ContatoImportado | null> {
  const mgr = gerenciador()
  if (!mgr) return null
  let props = ['name', 'tel', 'email']
  try {
    const disponiveis = (await mgr.getProperties?.()) || props
    props = ['name', 'tel', 'email', 'address'].filter((p) => disponiveis.includes(p))
  } catch {
    /* segue com o básico */
  }
  const [c] = await mgr.select(props, { multiple: false })
  if (!c) return null
  const adr = c.address?.[0]
  return {
    nome: c.name?.[0]?.trim(),
    telefone: c.tel?.[0],
    email: c.email?.[0],
    endereco: adr?.addressLine?.join(', '),
    bairro: adr?.dependentLocality,
    cidade: adr?.city,
    uf: adr?.region,
    cep: adr?.postalCode,
  }
}

/** Lê um contato .vcf (o WhatsApp e a agenda do celular compartilham contatos nesse formato). */
export function lerVcard(texto: string): ContatoImportado | null {
  const linhas = texto.replace(/\r\n[ \t]/g, '').split(/\r?\n/)
  const out: ContatoImportado = {}
  for (const linha of linhas) {
    const i = linha.indexOf(':')
    if (i < 0) continue
    const chave = linha.slice(0, i).toUpperCase()
    const valor = linha.slice(i + 1).trim()
    if (chave.startsWith('FN') && !out.nome) out.nome = valor
    else if (chave.startsWith('N') && !chave.startsWith('NOTE') && !out.nome) {
      const [sobrenome, nome] = valor.split(';')
      out.nome = [nome, sobrenome].filter(Boolean).join(' ').trim()
    } else if (chave.startsWith('TEL') || chave.includes('.TEL')) {
      if (!out.telefone) out.telefone = valor
    } else if (chave.startsWith('EMAIL') || chave.includes('.EMAIL')) {
      if (!out.email) out.email = valor
    } else if (chave.startsWith('ADR') || chave.includes('.ADR')) {
      const p = valor.split(';')
      out.endereco = [p[1], p[2]].filter(Boolean).join(', ') || out.endereco
      out.cidade = p[3] || out.cidade
      out.uf = p[4] || out.uf
      out.cep = p[5] || out.cep
    }
  }
  return out.nome || out.telefone ? out : null
}

/** Texto copiado do WhatsApp (ex.: "Maria Souza +55 66 99999-1234"). */
export function lerTextoColado(texto: string): ContatoImportado | null {
  if (/BEGIN:VCARD/i.test(texto)) return lerVcard(texto)
  const email = texto.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0]
  const fone = texto.match(/(\+?\d[\d\s().-]{8,}\d)/)?.[0]
  const nome = texto
    .replace(email || '', '')
    .replace(fone || '', '')
    .replace(/[~|:•-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!fone && !nome) return null
  return { nome: nome || undefined, telefone: fone, email }
}

/** CEP → endereço (ViaCEP, serviço público dos Correios). */
export async function buscarCep(cep: string): Promise<ContatoImportado | null> {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`)
    if (!res.ok) return null
    const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (j.erro) return null
    return { endereco: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf }
  } catch {
    return null
  }
}
