function getChartSvg(containerId: string): SVGElement | null {
  const container = document.getElementById(containerId)
  if (!container) return null
  return container.querySelector('svg')
}

function triggerDownload(href: string, fileName: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function exportChartAsSvg(containerId: string, fileName: string): boolean {
  const svg = getChartSvg(containerId)
  if (!svg) return false

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svg)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, fileName)
  URL.revokeObjectURL(url)
  return true
}

export async function exportChartAsPng(containerId: string, fileName: string): Promise<boolean> {
  const svg = getChartSvg(containerId)
  if (!svg) return false

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svg)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load chart image'))
      img.src = svgUrl
    })

    const width = svg.clientWidth || Number(svg.getAttribute('width')) || 1200
    const height = svg.clientHeight || Number(svg.getAttribute('height')) || 600
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    ctx.fillStyle = '#0b1020'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const pngUrl = canvas.toDataURL('image/png')
    triggerDownload(pngUrl, fileName)
    return true
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
