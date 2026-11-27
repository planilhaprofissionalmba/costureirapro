import { useCallback, useEffect, useState } from 'react'
import { listar } from './db'
import type { Preferencias } from './types'

export function useLista<T>(tabela: string, query = '') {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const r = await listar<T>(tabela, query)
    setLoading(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setError(null)
    setRows(r.data || [])
  }, [tabela, query])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, setRows, loading, error, reload }
}

export function usePreferencias() {
  const { rows, loading, reload } = useLista<Preferencias>('preferencias', 'limit=1')
  return { prefs: rows[0] || null, loading, reload }
}
