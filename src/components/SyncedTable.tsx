import { useEffect, useRef, type ReactNode } from 'react'

/** Iguala a largura de cada título à célula da mesma coluna, depois do layout. */
export function SyncedTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const sync = () => {
      const table = root.querySelector('table')
      if (!table) return
      const heads = Array.from(table.querySelectorAll('thead th')) as HTMLElement[]
      const row = table.querySelector('tbody tr')
      if (!row) return
      const cells = Array.from(row.children) as HTMLElement[]
      heads.forEach((th, index) => {
        const td = cells[index]
        if (!td) return
        const width = Math.ceil(Math.max(th.scrollWidth, td.scrollWidth))
        const px = `${width}px`
        if (th.style.minWidth !== px) th.style.minWidth = px
        if (td.style.minWidth !== px) td.style.minWidth = px
      })
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
