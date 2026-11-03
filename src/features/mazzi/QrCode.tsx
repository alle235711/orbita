import { useMemo } from 'react'

/** Bordo bianco in moduli: lo standard chiede almeno 4, senza il quale molti lettori non agganciano il codice. */
const QUIET = 4

/**
 * Il QR come SVG: un solo tracciato, moduli quadrati nitidi, sempre scuro su bianco (anche con il tema
 * scuro, o i lettori non lo riconoscono). Il testo alternativo è passato da chi lo usa.
 */
export function QrCode({ matrix, label }: { matrix: boolean[][]; label: string }) {
  const size = matrix.length + 2 * QUIET
  // Una striscia orizzontale per ogni serie di moduli scuri: un tracciato corto.
  const path = useMemo(() => {
    const parts: string[] = []
    matrix.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue
        let end = c
        while (end + 1 < row.length && row[end + 1]) end++
        parts.push(`M${c + QUIET} ${r + QUIET}h${end - c + 1}v1h-${end - c + 1}z`)
        c = end
      }
    })
    return parts.join('')
  }, [matrix])
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
