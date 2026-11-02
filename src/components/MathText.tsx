import { Fragment, useId, useMemo } from 'react'
import 'katex/dist/katex.min.css'
import { useT } from '../i18n/store'
import { splitMath } from '../math/delimiters'
import { renderTex } from '../math/render'
import './MathText.css'

interface MathTextProps {
  /** Il testo della scheda, sorgente compreso: resta la fonte per confronti e battitura. */
  source: string
  /** La lettura a parole delle formule (`formulaReading`), facoltativa. */
  reading?: string
  as?: 'span' | 'p' | 'div'
  className?: string
}

/**
 * Il testo di una scheda con le formule `$...$` e `$$...$$` rese da KaTeX.
 * L'HTML di KaTeX è nascosto ai lettori di schermo, che leggono il MathML;
 * la lettura facoltativa compare sotto e descrive le formule in display.
 */
export function MathText({ source, reading, as: Tag = 'span', className }: MathTextProps) {
  const t = useT()
  const id = useId()
  const segments = useMemo(() => splitMath(source), [source])
  const hasMath = segments.some((s) => s.type !== 'text')
  const words = hasMath ? reading?.trim() ?? '' : ''
  return (
    <Tag className={`math-text${className ? ` ${className}` : ''}`}>
      {segments.map((s, i) =>
        s.type === 'text' ? (
          <Fragment key={i}>{s.value}</Fragment>
        ) : (
          <span
            key={i}
            className={`math math--${s.type}`}
            aria-describedby={s.type === 'display' && words ? id : undefined}
            dangerouslySetInnerHTML={{ __html: renderTex(s.value, s.type === 'display') }}
          />
        ),
      )}
      {words ? (
        <span id={id} className="math-text__reading">
          <span className="math-text__reading-label">{t.math.reading}</span> {words}
        </span>
      ) : null}
    </Tag>
  )
}
