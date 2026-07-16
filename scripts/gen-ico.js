/**
 * Regenerate icon.ico from icon.png so the Windows taskbar (which uses the .ico
 * embedded in the .exe by electron-builder) shows the SAME logo as the system-tray
 * icon (which uses icon.png at runtime). Keeping both derived from one source PNG
 * is what keeps the taskbar and tray in sync.
 *
 * Run: node scripts/gen-ico.js
 *
 * png-to-ico requires a SQUARE PNG, but the source logo is not square, so we first
 * pad it onto a transparent square canvas (centered) using pngjs — no native deps.
 * png-to-ico then emits a multi-size .ico (down-scaled internally) from that square.
 */
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')
// png-to-ico ships as an ESM-interop module: the function is on `.default`.
const pngToIco = require('png-to-ico').default

const root = path.join(__dirname, '..')
const src = path.join(root, 'icon.png')
const out = path.join(root, 'icon.ico')

if (!fs.existsSync(src)) {
  console.error(`Source PNG not found: ${src}`)
  process.exit(1)
}

// Pad `png` onto a transparent square canvas of side = max(width, height),
// centering the original. Returns a new PNG. Pixel copy is a straight RGBA blit.
function padToSquare(png) {
  const side = Math.max(png.width, png.height)
  if (png.width === side && png.height === side) return png
  const square = new PNG({ width: side, height: side, colorType: 6 })
  // Fully transparent background.
  square.data.fill(0)
  const offX = Math.floor((side - png.width) / 2)
  const offY = Math.floor((side - png.height) / 2)
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const sIdx = (png.width * y + x) << 2
      const dIdx = (side * (y + offY) + (x + offX)) << 2
      square.data[dIdx] = png.data[sIdx]
      square.data[dIdx + 1] = png.data[sIdx + 1]
      square.data[dIdx + 2] = png.data[sIdx + 2]
      square.data[dIdx + 3] = png.data[sIdx + 3]
    }
  }
  return square
}

const source = PNG.sync.read(fs.readFileSync(src))
const square = padToSquare(source)
const squareBuf = PNG.sync.write(square)

pngToIco(squareBuf)
  .then((buf) => {
    fs.writeFileSync(out, buf)
    console.log(
      `✅ Wrote ${out} (${buf.length} bytes) from ${src} ` +
        `(padded ${source.width}x${source.height} -> ${square.width}x${square.width})`
    )
  })
  .catch((err) => {
    console.error('Failed to generate icon.ico:', err.message)
    process.exit(1)
  })
