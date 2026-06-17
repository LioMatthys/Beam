// Official Beam icon = "Remote tap" (E): gradient tile + white phone-with-tap-ripple.
// Emits every asset: rounded tiles (app/.ico/UI/site) + full-bleed squares (launcher).
const fs = require('fs')
const path = require('path')
const { createCanvas } = require('@napi-rs/canvas')
const OUT = path.join(__dirname, 'out', 'official')
fs.mkdirSync(OUT, { recursive: true })
const APR = '#FFA24B', PUR = '#B24BE6', BLU = '#2E9BFF', DARK = '#0F0F14'

function grad(ctx, S) {
  const g = ctx.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, APR); g.addColorStop(0.5, PUR); g.addColorStop(1, BLU)
  return g
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
// Phone + tap-ripple, in `color`, scaled by k, centered in an S box.
function mark(ctx, S, color, k) {
  const cx = S / 2, cy = S / 2
  ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const pw = S * 0.3 * k, ph = S * 0.48 * k
  ctx.lineWidth = S * 0.034 * k
  rr(ctx, cx - pw / 2, cy - ph / 2, pw, ph, S * 0.06 * k); ctx.stroke()
  ctx.save()
  ctx.globalAlpha = 0.55; ctx.lineWidth = S * 0.022 * k
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.085 * k, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.3
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.125 * k, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.05 * k, 0, Math.PI * 2); ctx.fill()
}
function tile(S, { round, bg }) {
  const c = createCanvas(S, S)
  const ctx = c.getContext('2d')
  if (bg !== 'transparent') {
    if (round) rr(ctx, 0, 0, S, S, S * 0.22)
    else { ctx.beginPath(); ctx.rect(0, 0, S, S) }
    ctx.fillStyle = bg === 'gradient' ? grad(ctx, S) : bg
    ctx.fill()
  }
  return { c, ctx }
}
function png(c) { return c.toBuffer('image/png') }
function webp(c) { return c.toBuffer('image/webp') }

// --- rounded gradient tiles (app icon, .ico, UI logos, site) ---
function rounded(S) { const { c, ctx } = tile(S, { round: true, bg: 'gradient' }); mark(ctx, S, '#fff', 1); return c }
// --- full-bleed gradient square (launcher: masked by the OS) ---
function square(S) { const { c, ctx } = tile(S, { round: false, bg: 'gradient' }); mark(ctx, S, '#fff', 0.82); return c }
// --- transparent white mark (adaptive monochrome) ---
function mono(S) { const { c, ctx } = tile(S, { round: false, bg: 'transparent' }); mark(ctx, S, '#fff', 0.82); return c }

fs.writeFileSync(path.join(OUT, 'icon-256.png'), png(rounded(256)))
fs.writeFileSync(path.join(OUT, 'icon-1024.png'), png(rounded(1024)))
fs.writeFileSync(path.join(OUT, 'android-icon-foreground.png'), png(square(1024)))
fs.writeFileSync(path.join(OUT, 'android-icon-monochrome.png'), png(mono(1024)))

// multi-size .ico (rounded)
const icoSizes = [256, 128, 64, 48, 32, 16]
const imgs = icoSizes.map((s) => ({ w: s, buf: png(rounded(s)) }))
function packIco(list) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2); header.writeUInt16LE(list.length, 4)
  const dir = Buffer.alloc(list.length * 16)
  let off = 6 + list.length * 16
  list.forEach((im, i) => {
    const b = i * 16
    dir.writeUInt8(im.w >= 256 ? 0 : im.w, b); dir.writeUInt8(im.w >= 256 ? 0 : im.w, b + 1)
    dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6)
    dir.writeUInt32LE(im.buf.length, b + 8); dir.writeUInt32LE(off, b + 12)
    off += im.buf.length
  })
  return Buffer.concat([header, dir, ...list.map((im) => im.buf)])
}
fs.writeFileSync(path.join(OUT, 'icon.ico'), packIco(imgs))

// launcher mipmaps (full-bleed gradient square + mark)
const DEN = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, sc] of Object.entries(DEN)) {
  const dir = path.join(OUT, 'launcher', 'mipmap-' + d)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.webp'), webp(square(Math.round(108 * sc))))
  fs.writeFileSync(path.join(dir, 'ic_launcher.webp'), webp(square(Math.round(48 * sc))))
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.webp'), webp(square(Math.round(48 * sc))))
}

// preview
const pv = createCanvas(300, 300); const px = pv.getContext('2d')
px.fillStyle = DARK; px.fillRect(0, 0, 300, 300)
const img = rounded(200)
px.drawImage(img, 50, 50)
fs.writeFileSync(path.join(OUT, 'preview.png'), png(pv))
console.log('OFFICIAL_ICON_DONE')
