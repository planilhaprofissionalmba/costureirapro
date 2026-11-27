/** Hub único cqirovvxtyreuvucosol. A chave anon é pública (não é identidade nem autorização). */
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://cqirovvxtyreuvucosol.supabase.co').replace(/\/$/, '')
const ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaXJvdnZ4dHlyZXV2dWNvc29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTQxMjgsImV4cCI6MjA5NjUzMDEyOH0.JB1iHDKsC6im0twZs1J5C7bNh4SgJi9YbtoYHFyorjg'

/** Crachá de sessão (V3.33): token opaco no cabeçalho; o RLS confere em costureirapro.session_account_id(). */
export const SESSION_HEADER = 'x-costureirapro-session'
export const SCHEMA = 'costureirapro'

export function authUrl() {
  return `${SUPABASE_URL}/functions/v1/costureirapro-auth`
}

export function restUrl(path: string) {
  return `${SUPABASE_URL}/rest/v1/${path}`
}

export function dataApiHeaders(sessionToken: string): Record<string, string> {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
    'Accept-Profile': SCHEMA,
    'Content-Profile': SCHEMA,
    [SESSION_HEADER]: sessionToken,
  }
}

export async function callAuth(action: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  try {
    const session = typeof body.token === 'string' ? body.token : ''
    const res = await fetch(authUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        ...(session ? { [SESSION_HEADER]: session } : {}),
      },
      body: JSON.stringify({ action, ...body }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return { ...data, error: String(data.error || 'Não foi possível concluir agora. Tente de novo.'), status: res.status }
    }
    return data
  } catch {
    return { error: 'Não foi possível conectar. Verifique a internet e tente de novo.' }
  }
}
