import { useSyncExternalStore } from 'react'

// Conferme brevi ("Registrati 45 minuti di corsa."), da qualunque schermata.

export interface ToastMessage {
  id: number
  text: string
  tone: 'ok' | 'error'
}

let messages: ToastMessage[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(text: string, tone: ToastMessage['tone'] = 'ok', ms = 4200): void {
  const id = nextId++
  messages = [...messages.slice(-2), { id, text, tone }]
  emit()
  window.setTimeout(() => dismiss(id), ms)
}

export function dismiss(id: number): void {
  messages = messages.filter((m) => m.id !== id)
  emit()
}

export function useToasts(): ToastMessage[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => messages,
    () => messages,
  )
}
