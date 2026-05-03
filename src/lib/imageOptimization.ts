interface OptimizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const DEFAULTS: Required<OptimizeOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
}

function shouldSkipOptimization(file: File): boolean {
  if (!file.type.startsWith('image/')) return true
  if (file.type === 'image/gif') return true
  return false
}

export async function optimizeImageForUpload(file: File, options: OptimizeOptions = {}): Promise<File> {
  if (shouldSkipOptimization(file)) return file

  const { maxWidth, maxHeight, quality } = { ...DEFAULTS, ...options }
  const imageBitmap = await createImageBitmap(file)

  const scale = Math.min(maxWidth / imageBitmap.width, maxHeight / imageBitmap.height, 1)
  const width = Math.round(imageBitmap.width * scale)
  const height = Math.round(imageBitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  ctx.drawImage(imageBitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality)
  )

  imageBitmap.close()

  if (!blob) return file
  if (blob.size >= file.size) return file

  const normalizedName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${normalizedName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}
