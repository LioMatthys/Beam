// Logo concepts v2 — theme: "an AI agent taking control of a phone."
// Gradient tiles (apricot→purple→blue), bold white marks.
const fs = require('fs')
const path = require('path')
const { createCanvas } = require('@napi-rs/canvas')
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })
const APR = '#FFA24B', PUR = '#B24BE6', BLU = '#2E9BFF'

function grad(ctx, S) {
  const g = ctx.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, APR); g.addColorStop(0.5, PUR); g.addColorStop(1, BLU)
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
function tile(S) {
  const c = createCanvas(S, S)
  const ctx = c.getContext('2d')
  rr(ctx, 0, 0, S, S, S * 0.22)
  ctx.fillStyle = grad(ctx, S)
  ctx.fill()
  ctx.save(); ctx.clip()
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  return { c, ctx }
}

// E — Remote tap: a phone with a tap-ripple on its screen (agent touches it).
function E(S) {
  const { c, ctx } = tile(S)
  const pw = S * 0.34, ph = S * 0.5
  const px = (S - pw) / 2, py = (S - ph) / 2
  ctx.lineWidth = S * 0.035
  rr(ctx, px, py, pw, ph, S * 0.06); ctx.stroke()
  const cx = S / 2, cy = S / 2
  // ripple rings
  ctx.globalAlpha = 0.55; ctx.lineWidth = S * 0.022
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.085, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.3
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.125, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 1
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.05, 0, Math.PI * 2); ctx.fill()
  ctx.restore(); return c
}

// F — Cursor: a bold pointer with a click-burst (the agent driving).
function F(S) {
  const { c, ctx } = tile(S)
  const pts = [
    [0, 0], [0, 0.74], [0.2, 0.57], [0.32, 0.86], [0.43, 0.81], [0.31, 0.53], [0.52, 0.53],
  ]
  const sz = S * 0.46, ox = S * 0.34, oy = S * 0.2
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    const X = ox + x * sz, Y = oy + y * sz
    i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
  })
  ctx.closePath(); ctx.fill()
  // click-burst near the tip
  ctx.lineWidth = S * 0.022
  const tx = ox, ty = oy
  for (const a of [-2.5, -1.9, -1.3]) {
    ctx.beginPath()
    ctx.moveTo(tx + Math.cos(a) * S * 0.07, ty + Math.sin(a) * S * 0.07)
    ctx.lineTo(tx + Math.cos(a) * S * 0.13, ty + Math.sin(a) * S * 0.13)
    ctx.stroke()
  }
  ctx.restore(); return c
}

// G — Reach-in: a beam arrow enters a phone and lands as a tap (agent drives device).
function G(S) {
  const { c, ctx } = tile(S)
  const pw = S * 0.32, ph = S * 0.48
  const px = S * 0.44, py = (S - ph) / 2
  ctx.lineWidth = S * 0.034
  rr(ctx, px, py, pw, ph, S * 0.06); ctx.stroke()
  // arrow beam from left into the screen
  const y = S / 2
  ctx.lineWidth = S * 0.05
  ctx.beginPath(); ctx.moveTo(S * 0.16, y); ctx.lineTo(S * 0.5, y); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(S * 0.46, y - S * 0.05); ctx.lineTo(S * 0.55, y); ctx.lineTo(S * 0.46, y + S * 0.05)
  ctx.stroke()
  // tap dot where it lands
  ctx.beginPath(); ctx.arc(S * 0.6, y, S * 0.045, 0, Math.PI * 2); ctx.fill()
  ctx.restore(); return c
}

const items = [
  { k: 'E', name: 'Remote tap', draw: E },
  { k: 'F', name: 'Cursor', draw: F },
  { k: 'G', name: 'Reach-in', draw: G },
]
for (const it of items) fs.writeFileSync(path.join(OUT, `concept-${it.k}.png`), it.draw(256).toBuffer('image/png'))
console.log('NEW_LOGOS_DONE')
