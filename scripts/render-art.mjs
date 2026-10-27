// Pre-renderizza le immagini costose da calcolare nel browser (SPEC §2):
// la nebulosa con feTurbulence peserebbe troppo su Safari se disegnata dal
// vivo, quindi la disegna Chromium una volta e la salviamo in public/art/.
//
//   npm run gen:art            tutte le immagini
//   npm run gen:art -- grain   solo quelle che contengono "grain" nel nome

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (name) => join(root, 'public', name)

/** Nebulosa a due colori della Copertina: rosa H alfa e azzurro O III. */
const nebulaCover = `
<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="820" viewBox="0 0 1180 820">
  <defs>
    <filter id="nebA" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0042 0.0068" numOctaves="4" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0.88  0 0 0 0 0.28  0 0 0 0 0.62  3.2 0 0 0 -1.5"/></filter>
    <filter id="nebB" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0062 0.0038" numOctaves="4" seed="29"/><feColorMatrix type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.70  0 0 0 0 0.80  3 0 0 0 -1.45"/></filter>
    <radialGradient id="nebMask" cx="860" cy="230" r="640" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="nebM"><rect width="1180" height="820" fill="url(#nebMask)"/></mask>
  </defs>
  <rect width="1180" height="820" fill="#070A16"/>
  <g mask="url(#nebM)" opacity="0.5">
    <rect width="1180" height="820" filter="url(#nebA)"/>
    <rect width="1180" height="820" filter="url(#nebB)"/>
  </g>
</svg>`

/**
 * Nebulosa a emissione del Briefing: più H alfa, un fronte di ionizzazione
 * più luminoso e qualche filamento di polvere scura, sempre sullo stesso cielo.
 */
const nebulaEmission = `
<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="820" viewBox="0 0 1180 820">
  <defs>
    <filter id="ha" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0036 0.0052" numOctaves="5" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0.92  0 0 0 0 0.30  0 0 0 0 0.52  3.4 0 0 0 -1.45"/></filter>
    <filter id="oiii" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0058 0.0041" numOctaves="4" seed="41"/><feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.72  0 0 0 0 0.84  2.8 0 0 0 -1.5"/></filter>
    <filter id="dust" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.011 0.006" numOctaves="3" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.03  0 0 0 0 0.04  0 0 0 0 0.09  4 0 0 0 -2.3"/></filter>
    <radialGradient id="m1" cx="890" cy="250" r="700" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="core" cx="930" cy="230" r="240" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFD9E8" stop-opacity="0.35"/><stop offset="1" stop-color="#FFD9E8" stop-opacity="0"/></radialGradient>
    <mask id="mask"><rect width="1180" height="820" fill="url(#m1)"/></mask>
  </defs>
  <rect width="1180" height="820" fill="#070A16"/>
  <g mask="url(#mask)">
    <g opacity="0.62"><rect width="1180" height="820" filter="url(#ha)"/></g>
    <g opacity="0.4"><rect width="1180" height="820" filter="url(#oiii)"/></g>
    <rect width="1180" height="820" fill="url(#core)"/>
    <g opacity="0.7"><rect width="1180" height="820" filter="url(#dust)"/></g>
  </g>
</svg>`

/** Tessera di grana ripetibile (stitchTiles), in scala di grigi con trasparenza. */
const grain = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  <rect width="128" height="128" filter="url(#g)"/>
</svg>`

/** Icona dell'app: il buco nero del giorno, semplificato. `k` lo rimpicciolisce per la zona sicura delle icone maskable. */
const icon = (size, k = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="256" cy="256" r="230" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFCF6E" stop-opacity="0.55"/><stop offset="0.5" stop-color="#FFCF6E" stop-opacity="0.16"/><stop offset="1" stop-color="#FFCF6E" stop-opacity="0"/></radialGradient>
    <linearGradient id="dop" x1="40" y1="0" x2="472" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.25" stop-color="#FFCF6E"/><stop offset="0.7" stop-color="#FFCF6E" stop-opacity="0.65"/><stop offset="1" stop-color="#FFCF6E" stop-opacity="0.3"/></linearGradient>
    <linearGradient id="lens" x1="150" y1="0" x2="362" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.4" stop-color="#FFCF6E"/><stop offset="1" stop-color="#FFCF6E" stop-opacity="0.5"/></linearGradient>
    <clipPath id="front"><rect x="0" y="256" width="512" height="256"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="#070A16"/>
  <g transform="translate(256 256) scale(${k}) translate(-256 -256) rotate(-12 256 256)">
    <circle cx="256" cy="256" r="230" fill="url(#glow)"/>
    <path d="M40,256 a216,52 0 1,0 432,0 a216,52 0 1,0 -432,0 Z M148,256 a108,26 0 1,0 216,0 a108,26 0 1,0 -216,0 Z" fill="url(#dop)" fill-rule="evenodd"/>
    <path d="M160,256 A96,96 0 0,1 352,256" fill="none" stroke="url(#lens)" stroke-width="30" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="76" fill="#000"/>
    <circle cx="256" cy="256" r="80" fill="none" stroke="#FFFFFF" stroke-width="3.5" opacity="0.9"/>
    <g clip-path="url(#front)">
      <path d="M40,256 a216,52 0 1,0 432,0 a216,52 0 1,0 -432,0 Z M148,256 a108,26 0 1,0 216,0 a108,26 0 1,0 -216,0 Z" fill="url(#dop)" fill-rule="evenodd"/>
    </g>
  </g>
</svg>`

const jobs = [
  { name: 'icons/icon-192.png', svg: icon(192), width: 192, height: 192, scale: 1, type: 'image/png' },
  { name: 'icons/icon-512.png', svg: icon(512), width: 512, height: 512, scale: 1, type: 'image/png' },
  { name: 'icons/icon-maskable-512.png', svg: icon(512, 0.74), width: 512, height: 512, scale: 1, type: 'image/png' },
  { name: 'icons/apple-touch-icon.png', svg: icon(180, 0.86), width: 180, height: 180, scale: 1, type: 'image/png' },
  { name: 'art/nebula-oggi.webp', svg: nebulaCover, width: 1180, height: 820, scale: 1.5, type: 'image/webp', quality: 0.8 },
  { name: 'art/nebula-briefing.webp', svg: nebulaEmission, width: 1180, height: 820, scale: 1.5, type: 'image/webp', quality: 0.8 },
  { name: 'art/grain.webp', svg: grain, width: 128, height: 128, scale: 1, type: 'image/webp', quality: 0.7, transparent: true },
]

async function render(page, job) {
  await page.setViewportSize({ width: job.width, height: job.height })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${job.svg}</body></html>`,
  )
  const png = await page.locator('svg').screenshot({ omitBackground: !!job.transparent, type: 'png' })
  if (job.type === 'image/png') return png
  // Chromium sa codificare WebP: si passa dal canvas.
  const dataUrl = await page.evaluate(
    async ({ b64, type, quality }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      return canvas.toDataURL(type, quality)
    },
    { b64: png.toString('base64'), type: job.type, quality: job.quality },
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

const filter = process.argv[2]
const browser = await chromium.launch()
for (const job of jobs.filter((j) => !filter || j.name.includes(filter))) {
  const context = await browser.newContext({ deviceScaleFactor: job.scale })
  const page = await context.newPage()
  const data = await render(page, job)
  await mkdir(dirname(out(job.name)), { recursive: true })
  await writeFile(out(job.name), data)
  console.log(`${job.name}  ${(data.length / 1024).toFixed(0)} KB`)
  await context.close()
}
await browser.close()
