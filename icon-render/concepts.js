// Logo/icon concept explorations for Beam (apricot -> flashy-blue brand).
const fs = require('fs')
const path = require('path')
const { createCanvas } = require('@napi-rs/canvas')
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })
const BG = '#0F0F14'
const APR = '#FFA24B'
const PUR = '#B24BE6'
const BLU = '#2E9BFF'

function grad(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, APR)
  g.addColorStop(0.5, PUR)
  g.addColorStop(1, BLU)
  return g
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function tile(S, gradientBg) {
  const c = createCanvas(S, S)
  const ctx = c.getContext('2d')
  rr(ctx, 0, 0, S, S, S * 0.22)
  ctx.fillStyle = gradientBg ? grad(ctx, 0, 0, S, S) : BG
  ctx.fill()
  ctx.save()
  ctx.clip()
  return { c, ctx }
}

// A — "Cast": broadcast arcs beaming out (dark tile, gradient mark)
function conceptA(S) {
  const { c, ctx } = tile(S, false)
  const ox = S * 0.3, oy = S * 0.7
  ctx.strokeStyle = grad(ctx, 0, S, S, 0)
  ctx.lineCap = 'round'
  for (let i = 1; i <= 3; i++) {
    ctx.lineWidth = S * 0.055
    ctx.beginPath()
    ctx.arc(ox, oy, S * 0.17 * i, -Math.PI / 2, 0)
    ctx.stroke()
  }
  ctx.fillStyle = grad(ctx, 0, S, S, 0)
  ctx.beginPath()
  ctx.arc(ox, oy, S * 0.055, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  return c
}

// B — Monogram "B" (gradient tile, white letter)
function conceptB(S) {
  const { c, ctx } = tile(S, true)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 ${Math.round(S * 0.66)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', S / 2, S * 0.55)
  ctx.restore()
  return c
}

// C — "Link": two devices joined by a gradient beam-bolt (dark tile)
function conceptC(S) {
  const { c, ctx } = tile(S, false)
  ctx.strokeStyle = '#3A3A48'
  ctx.lineWidth = S * 0.035
  rr(ctx, S * 0.12, S * 0.34, S * 0.2, S * 0.32, S * 0.04) // phone
  ctx.stroke()
  rr(ctx, S * 0.62, S * 0.36, S * 0.26, S * 0.2, S * 0.03) // laptop screen
  ctx.stroke()
  // beam-bolt between them
  ctx.fillStyle = grad(ctx, S * 0.3, 0, S * 0.7, 0)
  ctx.beginPath()
  ctx.moveTo(S * 0.36, S * 0.46)
  ctx.lineTo(S * 0.52, S * 0.42)
  ctx.lineTo(S * 0.47, S * 0.5)
  ctx.lineTo(S * 0.6, S * 0.46)
  ctx.lineTo(S * 0.44, S * 0.6)
  ctx.lineTo(S * 0.49, S * 0.52)
  ctx.lineTo(S * 0.36, S * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  return c
}

// D — "Pulse": a play/beam triangle with a radiating ring (gradient tile, white mark)
function conceptD(S) {
  const { c, ctx } = tile(S, true)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = S * 0.04
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(S * 0.42, S * 0.5, S * 0.26, -Math.PI / 3, Math.PI / 3)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.moveTo(S * 0.34, S * 0.34)
  ctx.lineTo(S * 0.34, S * 0.66)
  ctx.lineTo(S * 0.6, S * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  return c
}

const concepts = [
  { k: 'A', name: 'Cast', draw: conceptA },
  { k: 'B', name: 'Monogram', draw: conceptB },
  { k: 'C', name: 'Link', draw: conceptC },
  { k: 'D', name: 'Pulse', draw: conceptD },
]
for (const c of concepts) fs.writeFileSync(path.join(OUT, `concept-${c.k}.png`), c.draw(256).toBuffer('image/png'))

// Contact sheet: 2x2 with labels
const TILE = 240, PAD = 40, COLS = 2
const SW = COLS * TILE + (COLS + 1) * PAD
const SH = 2 * TILE + 3 * PAD + 2 * 30
const sheet = createCanvas(SW, SH)
const sx = sheet.getContext('2d')
sx.fillStyle = '#0a0a0e'
sx.fillRect(0, 0, SW, SH)
concepts.forEach((c, i) => {
  const col = i % 2, row = Math.floor(i / 2)
  const x = PAD + col * (TILE + PAD)
  const y = PAD + row * (TILE + PAD + 30)
  sx.drawImage(c.draw(TILE), x, y)
  sx.fillStyle = '#F2F4F7'
  sx.font = '700 20px system-ui, sans-serif'
  sx.textAlign = 'center'
  sx.fillText(`${c.k} · ${c.name}`, x + TILE / 2, y + TILE + 22)
})
fs.writeFileSync(path.join(OUT, 'concepts.png'), sheet.toBuffer('image/png'))
console.log('CONCEPTS_DONE')
