import { APP_SLUG } from './brand'

/** CSV (abre no Excel): separador ; e BOM UTF-8. Nome: costureirapro-<lista>-AAAA-MM-DD.csv */
export function exportCsv(filenamePrefix: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const today = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${APP_SLUG}-${filenamePrefix}-${today}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
