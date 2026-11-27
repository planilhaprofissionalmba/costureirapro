const STORAGE_KEY = 'costureirapro_recent_emails'
const MAX = 8

export function loadRecentEmails(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as unknown
    if (!Array.isArray(list)) return []
    return list
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => item.includes('@'))
      .slice(0, MAX)
  } catch {
    return []
  }
}

export function clearRecentEmails() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function saveRecentEmail(email: string) {
  const clean = email.trim().toLowerCase()
  if (!clean.includes('@')) return
  const next = [clean, ...loadRecentEmails().filter((item) => item !== clean)].slice(0, MAX)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

export function filterRecentEmails(query: string, all = loadRecentEmails()): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return all
  return all.filter((item) => item.includes(q))
}
