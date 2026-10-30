// Messaggi del piano: dati puri (chiave e parametri), il testo lo fa il dizionario.

import type { Dict } from './dict'
import type { Format } from './format/types'
import type { I18n } from './index'

export type MsgTable = Dict['plan']['msg']
export type MsgKey = keyof MsgTable
export type MsgParams<K extends MsgKey> = Parameters<MsgTable[K]>[0]
/** Unione discriminata: { k: 'examTitle'; p: { name: string } } | ... */
export type PlanMsg = { [K in MsgKey]: { k: K; p: MsgParams<K> } }[MsgKey]

/** Costruttore tipizzato: le chiavi senza parametri non vogliono il secondo argomento. */
export function m<K extends MsgKey>(k: K, ...p: {} extends MsgParams<K> ? [] | [MsgParams<K>] : [MsgParams<K>]): Extract<PlanMsg, { k: K }> {
  return { k, p: p[0] ?? {} } as unknown as Extract<PlanMsg, { k: K }>
}

export function renderMsg(msg: PlanMsg, i18n: Pick<I18n, 't' | 'f'>): string {
  const fn = i18n.t.plan.msg[msg.k] as (p: unknown, f: Format) => string
  return fn(msg.p ?? {}, i18n.f)
}
