/** Salva un oggetto come file JSON (su iPad apre il foglio di condivisione). */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${file.name} non è un file JSON valido.`)
  }
}
