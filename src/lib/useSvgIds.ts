import { useId, useMemo } from 'react'

export interface SvgIds {
  id(name: string): string
  url(name: string): string
}

/** Id SVG unici e stabili per istanza: `${useId() ripulito}-${nome}`. */
export function useSvgIds(): SvgIds {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return useMemo(() => {
    const id = (name: string) => `${uid}-${name}`
    return { id, url: (name: string) => `url(#${id(name)})` }
  }, [uid])
}
