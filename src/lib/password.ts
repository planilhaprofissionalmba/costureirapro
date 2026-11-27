/** Remove BOM/ZWSP/NBSP e espaços só nas pontas (cola do Word/WhatsApp). */
export function normalizePassword(password: string): string {
  return String(password || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/^\s+|\s+$/g, '')
}

export function validatePassword(password: string): string | null {
  const clean = normalizePassword(password)
  if (clean.length < 8) return 'A senha precisa ter no mínimo 8 caracteres.'
  if (!/[A-Za-zÀ-ÿ]/.test(clean) || !/[0-9]/.test(clean)) {
    return 'A senha precisa ter pelo menos 1 letra e 1 número.'
  }
  return null
}
