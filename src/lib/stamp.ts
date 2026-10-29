// Drawing the date onto a photo. Pure canvas code, no DOM beyond the
// canvas itself, so the preview and the full-size export draw the same way:
// every size is a fraction of the photo's shorter side.

export type StampStyle = "retro" | "classic" | "label"
export type StampPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left"
// Every format the editor offers. Which ones a page lists, and in which
// order, is the locale's choice (`dateFormats` in src/i18n/<locale>.ts):
// the country's own way of writing a date comes first.
export type DateFormat = "retro" | "dmy" | "dmy-time" | "dmy-slash" | "dmy-slash-time" | "mdy" | "iso"

export interface StampOptions {
  style: StampStyle
  position: StampPosition
  format: DateFormat
  /** Font size as a percentage of the photo's shorter side. */
  size: number
}

export const DEFAULT_OPTIONS: StampOptions = {
  style: "retro",
  position: "bottom-right",
  format: "retro",
  size: 4,
}

// The largest photo exported at full size. iOS and iPadOS Safari refuse
// canvases above ~16.7 million pixels, so there bigger photos are scaled
// down to 16 MP; everywhere else the full size is kept up to 100 MP (a
// medium-format camera's), and above that, too, it is scaled down.
// If a browser still fails at the full size, the editor retries at
// SAFE_EXPORT_PIXELS rather than saving nothing.
export const MAX_EXPORT_PIXELS = 100_000_000
export const SAFE_EXPORT_PIXELS = 16_000_000

/** The export cap for this device: 16 MP on iPhone and iPad, 100 MP elsewhere. */
export function maxExportPixels(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints ?? 0): number {
  // iPadOS reports itself as a Mac; only its touch screen gives it away.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)
  return ios ? SAFE_EXPORT_PIXELS : MAX_EXPORT_PIXELS
}

const pad = (n: number) => String(n).padStart(2, "0")

export function formatDate(date: Date, format: DateFormat): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  switch (format) {
    // Like the film cameras of the 90s: '98 7 14
    case "retro":
      return `'${pad(y % 100)} ${m} ${d}`
    case "dmy":
      return `${pad(d)}.${pad(m)}.${y}`
    case "dmy-slash":
      return `${pad(d)}/${pad(m)}/${y}`
    case "dmy-slash-time":
      return `${pad(d)}/${pad(m)}/${y} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    case "mdy":
      return `${pad(m)}/${pad(d)}/${y}`
    case "iso":
      return `${y}-${pad(m)}-${pad(d)}`
    case "dmy-time":
      return `${pad(d)}.${pad(m)}.${y} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}

export function drawStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  options: StampOptions,
) {
  const fontSize = Math.max(8, Math.round((Math.min(width, height) * options.size) / 100))
  const margin = Math.round(fontSize * 0.9)
  const right = options.position.endsWith("right")
  const bottom = options.position.startsWith("bottom")

  ctx.save()
  ctx.font =
    options.style === "retro"
      ? `700 ${fontSize}px "Courier New", ui-monospace, monospace`
      : `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.textAlign = right ? "right" : "left"
  ctx.textBaseline = bottom ? "bottom" : "top"

  const x = right ? width - margin : margin
  const y = bottom ? height - margin : margin

  switch (options.style) {
    case "retro":
      // Orange digits like the LED date of a film camera: a thin dark outline
      // (they hold on busy or green photos), then the digits with a faint glow.
      ctx.lineJoin = "round"
      ctx.lineWidth = Math.max(1, fontSize * 0.05)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)"
      ctx.strokeText(text, x, y)
      ctx.fillStyle = "#ff8a1f"
      ctx.shadowColor = "rgba(255, 80, 0, 0.5)"
      ctx.shadowBlur = fontSize * 0.15
      ctx.fillText(text, x, y)
      break
    case "classic":
      // A thin black outline under the white, so the date stays readable on
      // a white wall or a bright sky; the soft shadow goes with the outline.
      ctx.lineJoin = "round"
      ctx.lineWidth = Math.max(1, fontSize * 0.07)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)"
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = fontSize * 0.2
      ctx.shadowOffsetY = fontSize * 0.04
      ctx.strokeText(text, x, y)
      ctx.shadowColor = "transparent"
      ctx.fillStyle = "#ffffff"
      ctx.fillText(text, x, y)
      break
    case "label": {
      const padding = fontSize * 0.45
      const textWidth = ctx.measureText(text).width
      const boxWidth = textWidth + padding * 2
      const boxHeight = fontSize + padding * 1.4
      const boxX = right ? x - textWidth - padding : x - padding
      const boxY = bottom ? y - fontSize - padding * 0.7 : y - padding * 0.7
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
      ctx.beginPath()
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, fontSize * 0.3)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.fillText(text, x, y)
      break
    }
  }
  ctx.restore()
}

/** Scale so width × height fits in maxPixels (never upscales). */
export function fitPixels(width: number, height: number, maxPixels: number) {
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  // Rounded down: rounding up could land a few pixels over the limit.
  if (scale === 1) return { width, height }
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) }
}

/** The image drawn at the given size with the stamp on top. */
export function renderStamped(
  image: CanvasImageSource & { width: number; height: number },
  size: { width: number; height: number },
  text: string,
  options: StampOptions,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(image, 0, 0, size.width, size.height)
  drawStamp(ctx, size.width, size.height, text, options)
  return canvas
}

// 0.95: re-encoding costs some quality; at 0.95 the difference to the
// original is below what the eye sees (tests/e2e/quality.spec.ts checks it).
export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  )
}
