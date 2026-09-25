const DEFAULT_MAX_WIDTH = 1080
const DEFAULT_QUALITY = 0.82
const DEFAULT_MIME_TYPE = 'image/jpeg'

function getTargetSize(source, maxWidth) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Camera frame is not ready yet. Please try again.')
  }

  if (sourceWidth <= maxWidth) {
    return { width: sourceWidth, height: sourceHeight }
  }

  const scale = maxWidth / sourceWidth
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
  }
}

function drawWatermark(ctx, width, height, lines) {
  const cleanLines = lines.filter(Boolean)
  if (!cleanLines.length) return

  const padding = Math.max(18, Math.round(width * 0.028))
  const titleSize = Math.max(22, Math.round(width * 0.038))
  const bodySize = Math.max(17, Math.round(width * 0.028))
  const lineHeight = Math.round(bodySize * 1.35)
  const titleLineHeight = Math.round(titleSize * 1.25)
  const blockHeight = padding * 2 + titleLineHeight + lineHeight * (cleanLines.length - 1)
  const top = height - blockHeight

  const gradient = ctx.createLinearGradient(0, top, 0, height)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(0.28, 'rgba(0, 0, 0, 0.62)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.82)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, Math.max(0, top - padding), width, blockHeight + padding)

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1

  cleanLines.forEach((line, index) => {
    ctx.font =
      index === 0
        ? `700 ${titleSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        : `600 ${bodySize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.fillText(line, padding, top + padding + (index === 0 ? 0 : titleLineHeight + lineHeight * (index - 1)))
  })
}

export async function createAttendancePhotoBlob({
  source,
  watermarkLines = [],
  maxWidth = DEFAULT_MAX_WIDTH,
  mimeType = DEFAULT_MIME_TYPE,
  quality = DEFAULT_QUALITY,
  mirror = true,
} = {}) {
  if (!source) {
    throw new Error('No camera frame is available.')
  }

  const { width, height } = getTargetSize(source, maxWidth)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Your browser cannot prepare the attendance photo.')
  }

  ctx.save()
  if (mirror) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, 0, 0, width, height)
  ctx.restore()

  drawWatermark(ctx, width, height, watermarkLines)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result)
          return
        }
        reject(new Error('Unable to prepare the attendance photo.'))
      },
      mimeType,
      quality,
    )
  })

  return {
    blob,
    width,
    height,
    previewUrl: canvas.toDataURL(mimeType, quality),
  }
}
