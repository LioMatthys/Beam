/* Final Beam logo (phone -> arrow -> laptop, "Row"). Emits app-icon assets. */
const fs = require('fs')
const path = require('path')
const { createCanvas } = require('@napi-rs/canvas')
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

const BG = '#0F0F14'
const LIME = '#FFA24B' // apricot orange (gradient start)
const TEAL = '#2E9BFF' // flashy blue (gradient end)
let MONO = false

function gd(ctx, x0, y0, x1, y1) {
  if (MONO) return '#FFFFFF'
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, LIME)
  g.addColorStop(1, TEAL)
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
function phone(ctx, S, fx, fy, fw, fh, lw) {
  ctx.strokeStyle = gd(ctx, 0, 0, S, S)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  rr(ctx, fx * S, fy * S, fw * S, fh * S, lw * 0.9)
  ctx.stroke()
}
function laptop(ctx, S, sx, sy, sw, sh, lw) {
  ctx.strokeStyle = gd(ctx, 0, 0, S, S)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  rr(ctx, sx * S, sy * S, sw * S, sh * S, lw * 0.9)
  ctx.stroke()
  const by = (sy + sh) * S + lw * 1.1
  ctx.beginPath()
  ctx.moveTo((sx - 0.05) * S, by)
  ctx.lineTo((sx + sw + 0.05) * S, by)
  ctx.stroke()
}
function arrow(ctx, S, f1, f2, thick) {
  const x1 = f1[0] * S, y1 = f1[1] * S, x2 = f2[0] * S, y2 = f2[1] * S
  const len = Math.hypot(x2 - x1, y2 - y1)
  const w = thick * S
  const head = w * 1.7
  ctx.save()
  ctx.translate(x1, y1)
  ctx.rotate(Math.atan2(y2 - y1, x2 - x1))
  ctx.fillStyle = gd(ctx, 0, 0, len, 0)
  ctx.beginPath()
  ctx.moveTo(0, -w / 2)
  ctx.lineTo(len - head, -w / 2)
  ctx.lineTo(len - head, -head)
  ctx.lineTo(len, 0)
  ctx.lineTo(len - head, head)
  ctx.lineTo(len - head, w / 2)
  ctx.lineTo(0, w / 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// The chosen "Row" mark, drawn in a 0..S box.
function drawMark(ctx, S) {
  phone(ctx, S, 0.11, 0.37, 0.17, 0.3, S * 0.028)
  arrow(ctx, S, [0.33, 0.52], [0.5, 0.52], 0.05)
  laptop(ctx, S, 0.56, 0.36, 0.3, 0.22, S * 0.028)
}

function canvas(w, h) {
  return createCanvas(w, h === undefined ? w : h)
}
function pngBuf(c) {
  return c.toBuffer('image/png')
}
function save(name, c) {
  fs.writeFileSync(path.join(OUT, name), pngBuf(c))
}

// Full square icon (iOS / Expo `icon`): dark bg + mark.
function fullIcon(size) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, size, size)
  drawMark(ctx, size)
  return c
}
// Rounded tile with transparent corners (Windows .ico / UI).
function roundedIcon(size) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  rr(ctx, 0, 0, size, size, size * 0.22)
  ctx.fillStyle = BG
  ctx.fill()
  ctx.save()
  ctx.clip()
  drawMark(ctx, size)
  ctx.restore()
  return c
}
// Transparent foreground for Android adaptive (mark inside center safe zone).
function foreground(size, mono) {
  MONO = !!mono
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const safe = 0.66
  ctx.save()
  ctx.translate((size * (1 - safe)) / 2, (size * (1 - safe)) / 2)
  ctx.scale(safe, safe)
  drawMark(ctx, size)
  ctx.restore()
  MONO = false
  return c
}

// ---- exports ----
save('icon-1024.png', fullIcon(1024))
save('adaptive-foreground.png', foreground(1024, false))
save('adaptive-monochrome.png', foreground(1024, true))
save('icon-256.png', roundedIcon(256)) // UI / window icon

// Windows multi-size .ico (PNG-embedded)
const icoSizes = [256, 128, 64, 48, 32, 16]
const images = icoSizes.map((s) => ({ w: s, buf: pngBuf(roundedIcon(s)) }))
function packIco(imgs) {
  const count = imgs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const dir = Buffer.alloc(count * 16)
  let offset = 6 + count * 16
  imgs.forEach((im, i) => {
    const b = i * 16
    dir.writeUInt8(im.w >= 256 ? 0 : im.w, b + 0)
    dir.writeUInt8(im.w >= 256 ? 0 : im.w, b + 1)
    dir.writeUInt16LE(1, b + 4)
    dir.writeUInt16LE(32, b + 6)
    dir.writeUInt32LE(im.buf.length, b + 8)
    dir.writeUInt32LE(offset, b + 12)
    offset += im.buf.length
  })
  return Buffer.concat([header, dir, ...imgs.map((im) => im.buf)])
}
fs.writeFileSync(path.join(OUT, 'icon.ico'), packIco(images))

// --- Settings gear icon (white on transparent; tinted in the app) ---
function cog(ctx, S, color) {
  const cx = S / 2, cy = S / 2, teeth = 8
  const rBody = S * 0.3, rOuter = S * 0.45, rHole = S * 0.13
  const halfW = S * 0.075
  ctx.fillStyle = color
  ctx.save()
  ctx.translate(cx, cy)
  // Flat rectangular teeth radiating out (rounded ends).
  for (let i = 0; i < teeth; i++) {
    ctx.save()
    ctx.rotate(((Math.PI * 2) / teeth) * i)
    rr(ctx, -halfW, -rOuter, halfW * 2, rOuter, halfW * 0.5)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
  // Solid body, then punch the center hole → a ring with teeth.
  ctx.beginPath(); ctx.arc(cx, cy, rBody, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath(); ctx.arc(cx, cy, rHole, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}
{
  const gc = canvas(96)
  cog(gc.getContext('2d'), 96, '#FFFFFF')
  save('gear.png', gc)
}

// --- Android launcher mipmaps, recolored to the new palette (webp, per density) ---
const DEN = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, sc] of Object.entries(DEN)) {
  const dir = path.join(OUT, 'launcher', 'mipmap-' + d)
  fs.mkdirSync(dir, { recursive: true })
  const fg = Math.round(108 * sc) // adaptive foreground (108dp)
  const lg = Math.round(48 * sc) // legacy square / round (48dp)
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.webp'), foreground(fg, false).toBuffer('image/webp'))
  fs.writeFileSync(path.join(dir, 'ic_launcher.webp'), fullIcon(lg).toBuffer('image/webp'))
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.webp'), fullIcon(lg).toBuffer('image/webp'))
}

// Final preview (rounded big + 56px) for confirmation
const W = 460, H = 360
const pc = canvas(W, H)
const p = pc.getContext('2d')
p.fillStyle = '#0a0a0e'
p.fillRect(0, 0, W, H)
p.drawImage(roundedIcon(220), 120, 30)
p.drawImage(roundedIcon(56), 202, 270)
const wg = p.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0)
wg.addColorStop(0, LIME)
wg.addColorStop(1, TEAL)
p.fillStyle = wg
p.font = '900 30px system-ui, sans-serif'
p.textAlign = 'center'
p.fillText('Beam', 350, 300)
fs.writeFileSync(path.join(OUT, 'final-preview.png'), pngBuf(pc))

console.log('ICONS_DONE')
