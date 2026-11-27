import { callAuth, dataApiHeaders, restUrl } from './api'
import { SESSAO_EXPIRADA_EVENT, storedToken } from './auth'

/**
 * Data API (PostgREST) com o crachá de sessão no cabeçalho x-costureirapro-session.
 * O RLS confere o crachá e só devolve/aceita linhas da conta da sessão.
 * account_id enviado aqui é só o valor da linha — quem autoriza é o banco.
 */

const MSG_SESSAO = 'Sua sessão expirou. Entre de novo.'
const MSG_REDE = 'Não foi possível conectar. Verifique a internet e tente de novo.'

let ultimoToque = 0

async function garantirSessao(forcar = false): Promise<string | null> {
  const token = storedToken()
  if (!token) return null
  if (!forcar && Date.now() - ultimoToque < 4 * 60 * 1000) return token
  const data = await callAuth('touch', { token })
  if (data.error) {
    if (data.status === 401) window.dispatchEvent(new CustomEvent(SESSAO_EXPIRADA_EVENT))
    return null
  }
  ultimoToque = Date.now()
  return token
}

export type Resultado<T> = { data?: T; error?: string }

function mensagemErro(status: number, body: { message?: string; code?: string } | null): string {
  const code = body?.code || ''
  if (code === '23505') {
    if ((body?.message || '').includes('cpf')) return 'Já existe uma cliente com este CPF.'
    return 'Este registro já existe.'
  }
  if (code === '23503') return 'Este registro está ligado a outros dados e não pode ser apagado agora.'
  if (code === '23514') return 'Confira os campos: algum valor não é aceito.'
  if (code === '42501' || status === 401 || status === 403) return MSG_SESSAO
  return 'Não foi possível salvar agora. Tente de novo.'
}

async function chamar<T>(path: string, init: RequestInit = {}, escrita = false): Promise<Resultado<T>> {
  const token = await garantirSessao(false)
  if (!token) return { error: MSG_SESSAO }
  let res: Response
  try {
    res = await fetch(restUrl(path), {
      ...init,
      headers: { ...dataApiHeaders(token), ...(init.headers as Record<string, string> | undefined) },
    })
  } catch {
    return { error: MSG_REDE }
  }
  if (res.status === 204) return { data: undefined as T }
  const body = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    if (escrita && (res.status === 401 || res.status === 403)) {
      // Pode ser sessão vencida: confirma no servidor.
      const ok = await garantirSessao(true)
      if (!ok) return { error: MSG_SESSAO }
    }
    return { error: mensagemErro(res.status, body as { message?: string; code?: string }) }
  }
  return { data: body as T }
}

export function listar<T>(tabela: string, query = ''): Promise<Resultado<T[]>> {
  return chamar<T[]>(`${tabela}${query ? `?${query}` : ''}`)
}

export async function buscar<T>(tabela: string, id: string): Promise<Resultado<T | null>> {
  const r = await chamar<T[]>(`${tabela}?id=eq.${encodeURIComponent(id)}&limit=1`)
  if (r.error) return { error: r.error }
  return { data: r.data?.[0] ?? null }
}

export async function inserir<T>(tabela: string, linha: Record<string, unknown> | Record<string, unknown>[]): Promise<Resultado<T[]>> {
  return chamar<T[]>(tabela, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(linha) }, true)
}

export async function atualizar<T>(tabela: string, id: string, patch: Record<string, unknown>): Promise<Resultado<T[]>> {
  return chamar<T[]>(
    `${tabela}?id=eq.${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
    true,
  )
}

export async function apagar(tabela: string, id: string): Promise<Resultado<null>> {
  const r = await chamar<null>(`${tabela}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, true)
  return r.error ? { error: r.error } : { data: null }
}

/** Upsert por coluna única (ex.: preferencias.account_id). */
export async function salvarUnico<T>(tabela: string, coluna: string, linha: Record<string, unknown>): Promise<Resultado<T[]>> {
  return chamar<T[]>(
    `${tabela}?on_conflict=${coluna}`,
    { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(linha) },
    true,
  )
}
