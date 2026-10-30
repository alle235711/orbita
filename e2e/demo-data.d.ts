export interface DemoBackup {
  app: string
  format: number
  exportedAt: string
  tables: { [table: string]: unknown[]; settings: { id: string; value: unknown; updatedAt: number }[] }
}
export function demoBackup(today: string, options?: { deckIds?: string[] }): DemoBackup
