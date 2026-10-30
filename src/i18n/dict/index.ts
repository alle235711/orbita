import type { Lang } from '../lang'
import { en } from './en'
import { it } from './it'

export type Dict = typeof it

export const dicts: Record<Lang, Dict> = { it, en }
