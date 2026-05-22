import { useMemo, useCallback } from 'react'
import { TextSettings, CanvasSize, RowBounds, ImageTransform } from '../types'
import { scaleBounds } from '../utils/bounds'

interface LayoutLine {
  text: string
  x: number
  y: number
  width: number
}

interface Props {
  settings: TextSettings
  rowBounds: RowBounds
  canvasSize: CanvasSize
  maskWidth: number
  maskHeight: number
  imageTransform: ImageTransform
}

/**
 * Compute how the image maps onto the canvas and where the subject sits.
 */
function computeImageRect(
  imgW: number, imgH: number,
  canvasW: number, canvasH: number,
  transform: ImageTransform
) {
  // Cover: scale so image fills canvas, then apply user transform
  const coverScale = Math.max(canvasW / imgW, canvasH / imgH)
  const totalScale = coverScale * transform.scale
  const drawW = imgW * totalScale
  const drawH = imgH * totalScale
  const drawX = (canvasW - drawW) / 2 + transform.x
  const drawY = (canvasH - drawH) / 2 + transform.y
  return { drawX, drawY, drawW, drawH, totalScale }
}

export function useLayout({ settings, rowBounds, canvasSize, maskWidth, maskHeight, imageTransform }: Props) {
  // Scale the mask bounds to the current canvas dimensions, accounting for image transform
  const scaledBounds = useMemo(() => {
    if (!maskWidth || !maskHeight) return null

    const { drawX, drawY, drawW, drawH } = computeImageRect(
      maskWidth, maskHeight,
      canvasSize.width, canvasSize.height,
      imageTransform
    )

    // First scale the bounds to the drawn image size
    const imgScaled = scaleBounds(rowBounds, maskWidth, maskHeight, Math.round(drawW), Math.round(drawH))

    // Now offset them to canvas coordinates
    const left: number[] = new Array(canvasSize.height).fill(-1)
    const right: number[] = new Array(canvasSize.height).fill(-1)

    for (let cy = 0; cy < canvasSize.height; cy++) {
      const iy = cy - Math.round(drawY)
      if (iy >= 0 && iy < imgScaled.left.length) {
        if (imgScaled.left[iy] !== -1) {
          left[cy] = imgScaled.left[iy] + Math.round(drawX)
          right[cy] = imgScaled.right[iy] + Math.round(drawX)
        }
      }
    }

    return { left, right }
  }, [rowBounds, maskWidth, maskHeight, canvasSize, imageTransform])

  const lines = useMemo(() => {
    if (!scaledBounds) return []

    const { content, fontSize, lineHeight, side, padding, textStartY } = settings
    const cw = canvasSize.width
    const pad = padding

    const words = content.split(/\s+/).filter(Boolean)
    if (words.length === 0) return []

    // Create an offscreen canvas for text measurement
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')!
    measureCtx.font = `${fontSize}px "${settings.fontFamily}", sans-serif`

    const result: LayoutLine[] = []
    let wordIndex = 0
    let y = textStartY

    while (wordIndex < words.length && y + lineHeight <= canvasSize.height) {
      // Find the maximum subject intrusion in this line's vertical band
      const yStart = Math.floor(y)
      const yEnd = Math.min(Math.floor(y + lineHeight), canvasSize.height - 1)

      let subjectLeft = cw // rightmost left boundary
      let subjectRight = 0 // leftmost right boundary
      let hasSubject = false

      for (let sy = yStart; sy <= yEnd; sy++) {
        if (scaledBounds.left[sy] !== -1) {
          hasSubject = true
          subjectLeft = Math.min(subjectLeft, scaledBounds.left[sy])
          subjectRight = Math.max(subjectRight, scaledBounds.right[sy])
        }
      }

      // Compute available text region
      let textX: number
      let maxWidth: number

      if (!hasSubject) {
        // No subject at this height — full width
        textX = pad
        maxWidth = cw - pad * 2
      } else if (side === 'left') {
        // Text goes to the LEFT of the subject
        textX = pad
        maxWidth = Math.max(0, subjectLeft - pad * 2)
      } else if (side === 'right') {
        // Text goes to the RIGHT of the subject
        textX = subjectRight + pad
        maxWidth = Math.max(0, cw - subjectRight - pad * 2)
      } else {
        // 'both' — place on whichever side has more room
        const leftSpace = subjectLeft - pad * 2
        const rightSpace = cw - subjectRight - pad * 2
        if (leftSpace >= rightSpace) {
          textX = pad
          maxWidth = Math.max(0, leftSpace)
        } else {
          textX = subjectRight + pad
          maxWidth = Math.max(0, rightSpace)
        }
      }

      if (maxWidth < fontSize) {
        // Not enough space, skip this line
        y += lineHeight
        continue
      }

      // Greedy word fitting
      let lineText = ''
      let lineWidth = 0

      while (wordIndex < words.length) {
        const word = words[wordIndex]
        const testStr = lineText ? lineText + ' ' + word : word
        const testWidth = measureCtx.measureText(testStr).width

        if (testWidth <= maxWidth) {
          lineText = testStr
          lineWidth = testWidth
          wordIndex++
        } else {
          // If no words fit on this line at all, force one word
          if (!lineText) {
            lineText = word
            lineWidth = measureCtx.measureText(word).width
            wordIndex++
          }
          break
        }
      }

      if (lineText) {
        // Compute x based on alignment
        let finalX = textX
        if (settings.alignment === 'center') {
          finalX = textX + (maxWidth - lineWidth) / 2
        } else if (settings.alignment === 'right') {
          finalX = textX + maxWidth - lineWidth
        }

        result.push({
          text: lineText,
          x: finalX,
          y: y + fontSize, // baseline position
          width: lineWidth,
        })
      }

      y += lineHeight
    }

    return result
  }, [settings, scaledBounds, canvasSize])

  const renderFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    bgImage: HTMLImageElement,
    fgImage: HTMLImageElement | null,
  ) => {
    const cw = canvasSize.width
    const ch = canvasSize.height

    ctx.clearRect(0, 0, cw, ch)

    // 1. Draw background image (cover fit + user transform)
    const { drawX, drawY, drawW, drawH } = computeImageRect(
      bgImage.naturalWidth, bgImage.naturalHeight,
      cw, ch,
      imageTransform
    )
    ctx.drawImage(bgImage, drawX, drawY, drawW, drawH)

    // 2. Optional overlay dim
    if (settings.overlayOpacity > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${settings.overlayOpacity})`
      ctx.fillRect(0, 0, cw, ch)
    }

    // 3. Draw text lines
    ctx.font = `${settings.fontSize}px "${settings.fontFamily}", sans-serif`
    ctx.fillStyle = settings.color
    ctx.textBaseline = 'alphabetic'

    for (const line of lines) {
      ctx.fillText(line.text, line.x, line.y)
    }

    // 4. Optional 3D foreground overlay
    if (settings.enable3dEffect && fgImage) {
      ctx.drawImage(fgImage, drawX, drawY, drawW, drawH)
    }
  }, [canvasSize, imageTransform, settings, lines])

  return { lines, renderFrame }
}
