import { useMemo, useCallback } from 'react'
import { TextSettings, CanvasSize, RowBounds, ImageTransform, LyricLine } from '../types'
import { scaleBounds } from '../utils/bounds'

const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

interface LayoutLine {
  text: string
  x: number
  y: number
  width: number
}

interface Props {
  settings: TextSettings
  rowBounds: RowBounds | null
  canvasSize: CanvasSize
  maskWidth: number
  maskHeight: number
  imageTransform: ImageTransform
  lyricLines?: LyricLine[]
  currentTime?: number
  videoBounds?: RowBounds[] | null
}

/**
 * Compute how the image maps onto the canvas and where the subject sits.
 */
function computeImageRect(
  imgW: number, imgH: number,
  canvasW: number, canvasH: number,
  transform: ImageTransform
) {
  const coverScale = Math.max(canvasW / imgW, canvasH / imgH)
  const totalScale = coverScale * transform.scale
  const drawW = imgW * totalScale
  const drawH = imgH * totalScale
  const drawX = (canvasW - drawW) / 2 + transform.x
  const drawY = (canvasH - drawH) / 2 + transform.y
  return { drawX, drawY, drawW, drawH, totalScale }
}

function computeWrappedLines(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  scaledBounds: { left: number[]; right: number[] } | null,
  cw: number,
  ch: number,
  settings: TextSettings
): LayoutLine[] {
  if (!text) return []
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const { fontSize, fontFamily, lineHeight, side, padding, textStartY, alignment } = settings
  const pad = padding

  // Create a fallback/temporary canvas context if not provided
  let activeCtx = ctx
  if (!activeCtx) {
    const c = document.createElement('canvas')
    activeCtx = c.getContext('2d')!
  }
  activeCtx.font = `${fontSize}px "${fontFamily}", sans-serif`
  
  const widths = words.map(w => activeCtx!.measureText(w).width)
  const spaceWidth = activeCtx.measureText(' ').width

  const result: LayoutLine[] = []
  let wordIndex = 0
  let y = textStartY

  while (wordIndex < words.length && y + lineHeight <= ch) {
    const yStart = Math.floor(y)
    const yEnd = Math.min(Math.floor(y + lineHeight), ch - 1)

    let subjectLeft = cw
    let subjectRight = 0
    let hasSubject = false

    if (scaledBounds) {
      for (let sy = yStart; sy <= yEnd; sy++) {
        if (scaledBounds.left[sy] !== -1) {
          hasSubject = true
          subjectLeft = Math.min(subjectLeft, scaledBounds.left[sy])
          subjectRight = Math.max(subjectRight, scaledBounds.right[sy])
        }
      }
    }

    let textX: number
    let maxWidth: number

    if (!hasSubject) {
      textX = pad
      maxWidth = cw - pad * 2
    } else if (side === 'left') {
      textX = pad
      maxWidth = Math.max(0, subjectLeft - pad * 2)
    } else if (side === 'right') {
      textX = subjectRight + pad
      maxWidth = Math.max(0, cw - subjectRight - pad * 2)
    } else {
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
      y += lineHeight
      continue
    }

    let lineText = ''
    let lineWidth = 0

    while (wordIndex < words.length) {
      const word = words[wordIndex]
      const wWidth = widths[wordIndex]
      const testWidth = lineWidth === 0 ? wWidth : lineWidth + spaceWidth + wWidth

      if (testWidth <= maxWidth) {
        lineText = lineText ? lineText + ' ' + word : word
        lineWidth = testWidth
        wordIndex++
      } else {
        if (lineWidth === 0) {
          lineText = word
          lineWidth = wWidth
          wordIndex++
        }
        break
      }
    }

    if (lineText) {
      let finalX = textX
      if (alignment === 'center') {
        finalX = textX + (maxWidth - lineWidth) / 2
      } else if (alignment === 'right') {
        finalX = textX + maxWidth - lineWidth
      }

      result.push({
        text: lineText,
        x: finalX,
        y: y + fontSize,
        width: lineWidth,
      })
    }

    y += lineHeight
  }

  return result
}

/**
 * Pure frame-rendering function that operates completely independently of React's hook context.
 * Perfect for background video compilation, exports, and multi-threaded rendering pipelines.
 */
export function renderFramePure(
  ctx: CanvasRenderingContext2D,
  bgSource: HTMLImageElement | HTMLVideoElement,
  fgImage: HTMLImageElement | null,
  tempMaskCanvas: HTMLCanvasElement | undefined,
  frameTime: number | undefined,
  options: {
    settings: TextSettings
    rowBounds: RowBounds | null
    canvasSize: CanvasSize
    maskWidth: number
    maskHeight: number
    imageTransform: ImageTransform
    lyricLines?: LyricLine[]
    currentTime?: number
    videoBounds?: RowBounds[] | null
  }
) {
  const {
    settings,
    rowBounds,
    canvasSize,
    maskWidth,
    maskHeight,
    imageTransform,
    lyricLines = [],
    currentTime = 0,
    videoBounds = null,
  } = options

  const cw = canvasSize.width
  const ch = canvasSize.height

  ctx.clearRect(0, 0, cw, ch)

  // Get source dimensions
  const isVideo = bgSource instanceof HTMLVideoElement
  const srcW = isVideo ? (bgSource as HTMLVideoElement).videoWidth : (bgSource as HTMLImageElement).naturalWidth
  const srcH = isVideo ? (bgSource as HTMLVideoElement).videoHeight : (bgSource as HTMLImageElement).naturalHeight

  if (!srcW || !srcH) return

  // 1. Draw background image/video (cover fit + user transform)
  const { drawX, drawY, drawW, drawH } = computeImageRect(
    srcW, srcH,
    cw, ch,
    imageTransform
  )
  ctx.drawImage(bgSource, drawX, drawY, drawW, drawH)

  // 2. Optional overlay dim
  if (settings.overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${settings.overlayOpacity})`
    ctx.fillRect(0, 0, cw, ch)
  }

  // --- High-Fidelity Pre-computation of Subject Bounds & Text Wrap Exclusion Areas ---
  const activeTime = isVideo ? (frameTime !== undefined ? frameTime : currentTime) : 0
  let activeScaledBounds: { left: number[]; right: number[] } | null = null

  if (settings.mode === 'photo') {
    if (rowBounds && maskWidth && maskHeight) {
      const { drawX: dx, drawY: dy, drawW: dw, drawH: dh } = computeImageRect(
        maskWidth, maskHeight,
        cw, ch,
        imageTransform
      )
      const imgScaled = scaleBounds(rowBounds, maskWidth, maskHeight, Math.round(dw), Math.round(dh))
      const left: number[] = new Array(ch).fill(-1)
      const right: number[] = new Array(ch).fill(-1)
      const innerPadding = settings.innerPadding || 0
      const subjectOffset = settings.subjectOffset || 0

      for (let cy = 0; cy < ch; cy++) {
        const iy = cy - Math.round(dy)
        if (iy >= 0 && iy < imgScaled.left.length) {
          if (imgScaled.left[iy] !== -1) {
            const leftBoundary = imgScaled.left[iy] + Math.round(dx)
            const rightBoundary = imgScaled.right[iy] + Math.round(dx)
            left[cy] = Math.max(0, leftBoundary - innerPadding + subjectOffset)
            right[cy] = Math.min(cw, rightBoundary + innerPadding + subjectOffset)
          }
        }
      }
      activeScaledBounds = { left, right }
    }
  } else {
    if (videoBounds && videoBounds.length > 0) {
      const fps = 15
      const frameIndex = Math.min(
        Math.max(0, Math.floor(activeTime * fps)),
        videoBounds.length - 1
      )
      const currentRawBounds = videoBounds[frameIndex]

      if (currentRawBounds && maskWidth && maskHeight) {
        const { drawX: dx, drawY: dy, drawW: dw, drawH: dh } = computeImageRect(
          maskWidth, maskHeight,
          cw, ch,
          imageTransform
        )
        const imgScaled = scaleBounds(currentRawBounds, maskWidth, maskHeight, Math.round(dw), Math.round(dh))
        const left: number[] = new Array(ch).fill(-1)
        const right: number[] = new Array(ch).fill(-1)
        const innerPadding = settings.innerPadding || 0
        const subjectOffset = settings.subjectOffset || 0

        for (let cy = 0; cy < ch; cy++) {
          const iy = cy - Math.round(dy)
          if (iy >= 0 && iy < imgScaled.left.length) {
            if (imgScaled.left[iy] !== -1) {
              const leftBoundary = imgScaled.left[iy] + Math.round(dx)
              const rightBoundary = imgScaled.right[iy] + Math.round(dx)
              left[cy] = Math.max(0, leftBoundary - innerPadding + subjectOffset)
              right[cy] = Math.min(cw, rightBoundary + innerPadding + subjectOffset)
            }
          }
        }
        activeScaledBounds = { left, right }
      }
    }
  }

  // 2. Offscreen Text Canvas setup for pixel-perfect curved Matrix exclusion outlines
  const textCanvas = document.createElement('canvas')
  textCanvas.width = cw
  textCanvas.height = ch
  const textCtx = textCanvas.getContext('2d')!
  textCtx.clearRect(0, 0, cw, ch)

  // Draw all text layers onto textCtx first
  if (settings.mode === 'photo') {
    textCtx.save()
    textCtx.font = `${settings.fontSize}px "${settings.fontFamily}", sans-serif`
    textCtx.textBaseline = 'alphabetic'
    textCtx.globalAlpha = settings.textOpacity ?? 1.0

    // Set styles based on Preset
    if (settings.stylePreset === 'neon') {
      textCtx.shadowColor = settings.color
      textCtx.shadowBlur = 15
      textCtx.fillStyle = settings.color
    } else if (settings.stylePreset === 'outline') {
      textCtx.strokeStyle = settings.color
      textCtx.lineWidth = 2
    } else if (settings.stylePreset === 'gradient') {
      const grad = textCtx.createLinearGradient(0, 0, cw, 0)
      grad.addColorStop(0, settings.color)
      grad.addColorStop(1, '#00f2fe') // Secondary Cyan
      textCtx.fillStyle = grad
    } else {
      textCtx.fillStyle = settings.color
    }

    const classicLines = (activeScaledBounds && settings.content)
      ? computeWrappedLines(null, settings.content, activeScaledBounds, cw, ch, settings)
      : []

    for (const line of classicLines) {
      if (settings.stylePreset === 'outline') {
        textCtx.strokeText(line.text, line.x, line.y)
      } else {
        textCtx.fillText(line.text, line.x, line.y)
      }
    }
    textCtx.restore()
  } else {
    // Synced Video Mode: Draw scrolling dynamic lyrics
    if (settings.videoTextType === 'custom') {
      const lines = computeWrappedLines(textCtx, settings.content, activeScaledBounds, cw, ch, settings)

      textCtx.save()
      textCtx.font = `${settings.fontSize}px "${settings.fontFamily}", sans-serif`
      textCtx.textBaseline = 'alphabetic'
      textCtx.textAlign = 'left'
      textCtx.globalAlpha = settings.textOpacity ?? 1.0

      if (settings.stylePreset === 'neon') {
        textCtx.shadowColor = settings.color
        textCtx.shadowBlur = 15
        textCtx.fillStyle = settings.color
      } else if (settings.stylePreset === 'outline') {
        textCtx.strokeStyle = settings.color
        textCtx.lineWidth = 2
      } else if (settings.stylePreset === 'gradient') {
        const grad = textCtx.createLinearGradient(0, 0, cw, 0)
        grad.addColorStop(0, settings.color)
        grad.addColorStop(1, '#00f2fe')
        textCtx.fillStyle = grad
      } else {
        textCtx.fillStyle = settings.color
      }

      for (const line of lines) {
        if (settings.stylePreset === 'outline') {
          textCtx.strokeText(line.text, line.x, line.y)
        } else {
          textCtx.fillText(line.text, line.x, line.y)
        }
      }
      textCtx.restore()
    } else {
      if (lyricLines.length > 0) {
        const timeMs = activeTime * 1000
        let activeIdx = -1
        for (let i = 0; i < lyricLines.length; i++) {
          if (lyricLines[i].timestamp <= timeMs) {
            activeIdx = i
          } else {
            break
          }
        }

        if (activeIdx !== -1) {
          const activeLine = lyricLines[activeIdx]
          const nextLine = lyricLines[activeIdx + 1]

          let progress = 0
          if (nextLine) {
            const duration = nextLine.timestamp - activeLine.timestamp
            const elapsed = activeTime * 1000 - activeLine.timestamp
            progress = Math.min(1, Math.max(0, elapsed / (duration || 1)))
          }

          const activeFont = settings.lyricFontFamily || settings.fontFamily || 'Outfit'
          const activeFontSize = settings.lyricFontSize || settings.fontSize || 48
          const activeColor = settings.lyricColorActive || '#0f62fe'
          const inactiveColor = settings.lyricColorInactive || '#ffffff'
          const inactiveScale = settings.lyricInactiveScale ?? 0.9
          const inactiveOpacity = settings.lyricInactiveOpacity ?? 0.4
          const textStartY = settings.textStartY || ch / 2
          const lyricGap = activeFontSize * 1.6

          const startIdx = Math.max(0, activeIdx - 2)
          const endIdx = Math.min(lyricLines.length - 1, activeIdx + 2)

          for (let j = startIdx; j <= endIdx; j++) {
            const line = lyricLines[j]
            const isCurrentActive = j === activeIdx

            const lineOffset = j - activeIdx - progress
            const yPos = textStartY + lineOffset * lyricGap

            let opacity = 1
            let scale = 1
            let isGlowing = false

            if (isCurrentActive) {
              opacity = 1 - progress * (1 - inactiveOpacity)
              scale = 1 - progress * (1 - inactiveScale)
              isGlowing = settings.lyricGlowActive
            } else if (j === activeIdx + 1) {
              opacity = inactiveOpacity + progress * (1 - inactiveOpacity)
              scale = inactiveScale + progress * (1 - inactiveScale)
              isGlowing = settings.lyricGlowActive && progress > 0.8
            } else {
              opacity = inactiveOpacity
              scale = inactiveScale
            }

            textCtx.save()
            textCtx.font = `bold ${activeFontSize}px "${activeFont}", sans-serif`
            textCtx.textBaseline = 'middle'

            if (isGlowing) {
              textCtx.shadowColor = activeColor
              textCtx.shadowBlur = 20
              textCtx.fillStyle = '#ffffff'
            } else {
              textCtx.fillStyle = isCurrentActive ? activeColor : inactiveColor
            }

            textCtx.globalAlpha = opacity * (settings.textOpacity ?? 1.0)

            if (isCurrentActive && activeScaledBounds) {
              const pad = settings.padding
              const words = line.text.split(/\s+/).filter(Boolean)
              
              const wordWidths = words.map(w => textCtx.measureText(w).width)
              const spaceWidth = textCtx.measureText(' ').width

              const lineYStart = Math.floor(yPos - activeFontSize / 2)
              const lineYEnd = Math.min(Math.floor(yPos + activeFontSize / 2), ch - 1)

              let subjectLeft = cw
              let subjectRight = 0
              let hasSubject = false

              for (let sy = lineYStart; sy <= lineYEnd; sy++) {
                if (sy >= 0 && sy < ch && activeScaledBounds.left[sy] !== -1) {
                  hasSubject = true
                  subjectLeft = Math.min(subjectLeft, activeScaledBounds.left[sy])
                  subjectRight = Math.max(subjectRight, activeScaledBounds.right[sy])
                }
              }

              let textX = pad
              let maxWidth = cw - pad * 2

              if (hasSubject) {
                if (settings.side === 'left') {
                  maxWidth = Math.max(0, subjectLeft - pad * 2)
                } else if (settings.side === 'right') {
                  textX = subjectRight + pad
                  maxWidth = Math.max(0, cw - subjectRight - pad * 2)
                } else {
                  const leftSpace = subjectLeft - pad * 2
                  const rightSpace = cw - subjectRight - pad * 2
                  if (leftSpace >= rightSpace) {
                    maxWidth = Math.max(0, leftSpace)
                  } else {
                    textX = subjectRight + pad
                    maxWidth = Math.max(0, rightSpace)
                  }
                }
              }

              let lineText = ''
              let currentWidth = 0
              let wIdx = 0
              const subLines: { text: string; x: number }[] = []

              while (wIdx < words.length) {
                const word = words[wIdx]
                const wWidth = wordWidths[wIdx]
                const testW = currentWidth === 0 ? wWidth : currentWidth + spaceWidth + wWidth

                if (testW <= maxWidth) {
                  lineText = lineText ? lineText + ' ' + word : word
                  currentWidth = testW
                  wIdx++
                } else {
                  if (lineText) {
                    let fx = textX
                    if (settings.alignment === 'center') fx = textX + (maxWidth - currentWidth) / 2
                    else if (settings.alignment === 'right') fx = textX + maxWidth - currentWidth
                    subLines.push({ text: lineText, x: fx })
                  }
                  lineText = word
                  currentWidth = wWidth
                  wIdx++
                }
              }

              if (lineText) {
                let fx = textX
                if (settings.alignment === 'center') fx = textX + (maxWidth - currentWidth) / 2
                else if (settings.alignment === 'right') fx = textX + maxWidth - currentWidth
                subLines.push({ text: lineText, x: fx })
              }

              const totalWrapHeight = subLines.length * activeFontSize * 1.2
              const startWrapY = yPos - totalWrapHeight / 2 + activeFontSize / 2

              subLines.forEach((sl, sIdx) => {
                textCtx.fillText(sl.text, sl.x, startWrapY + sIdx * activeFontSize * 1.2)
              })

            } else {
              let textX = cw / 2
              textCtx.textAlign = 'center'

              if (settings.alignment === 'left') {
                textX = settings.padding
                textCtx.textAlign = 'left'
              } else if (settings.alignment === 'right') {
                textX = cw - settings.padding
                textCtx.textAlign = 'right'
              }

              textCtx.translate(textX, yPos)
              textCtx.scale(scale, scale)
              textCtx.fillText(line.text, 0, 0)
            }

            textCtx.restore()
          }
        }
      }
    }
  }

  // Get pixel-perfect alpha map of the drawn text for Matrix outline exclusion
  const textData = textCtx.getImageData(0, 0, cw, ch)

  // 3. Draw Background & Matrix grid on main ctx
  ctx.clearRect(0, 0, cw, ch)
  ctx.drawImage(bgSource, drawX, drawY, drawW, drawH)

  if (settings.overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${settings.overlayOpacity})`
    ctx.fillRect(0, 0, cw, ch)
  }

  // Draw Matrix Characters (with pixel-perfect curves outline)
  if (settings.enableMatrixEffect) {
    const charSize = settings.matrixCharSize || 16
    const opacity = settings.matrixCharOpacity ?? 0.35
    const color = settings.matrixCharColor || '#00ff00'

    ctx.save()
    ctx.font = `${charSize}px monospace`
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const stepX = charSize * 0.9
    const stepY = charSize * 1.2
    const timeSecs = activeTime || 0
    const frameSeed = Math.floor(timeSecs * 10)

    for (let gy = stepY / 2; gy < ch; gy += stepY) {
      const roundY = Math.floor(gy)
      let leftBound = -1
      let rightBound = -1
      if (activeScaledBounds && roundY >= 0 && roundY < ch) {
        leftBound = activeScaledBounds.left[roundY]
        rightBound = activeScaledBounds.right[roundY]
      }

      for (let gx = stepX / 2; gx < cw; gx += stepX) {
        // 1. Check if inside subject contour
        if (leftBound !== -1 && rightBound !== -1 && gx >= leftBound && gx <= rightBound) {
          continue
        }

        // 2. Check 9 sample points around (gx, gy) to form a perfect curve exclusion halo of 8px
        const px = Math.floor(gx)
        const py = Math.floor(gy)
        let inText = false
        
        const offsets = [
          [0, 0],
          [-8, 0], [8, 0], [0, -8], [0, 8],
          [-6, -6], [6, -6], [-6, 6], [6, 6]
        ]
        
        for (const [ox, oy] of offsets) {
          const tx = px + ox
          const ty = py + oy
          if (tx >= 0 && tx < cw && ty >= 0 && ty < ch) {
            const idx = (ty * cw + tx) * 4 + 3
            if (textData.data[idx] > 10) { // alpha threshold
              inText = true
              break
            }
          }
        }
        if (inText) continue

        // 3. Twinkle in-place
        const cellPos = Math.floor(gx / stepX) + Math.floor(gy / stepY) * 1000
        const cellSeed = Math.sin(cellPos) * 12345 + frameSeed * 67.89
        const charIdx = Math.floor(Math.abs(Math.sin(cellSeed) * 54321) % MATRIX_CHARS.length)
        const char = MATRIX_CHARS[charIdx]

        ctx.fillText(char, gx, gy)
      }
    }
    ctx.restore()
  }

  // 4. Draw computed textCanvas layer onto main ctx
  ctx.drawImage(textCanvas, 0, 0)

  // 5. Draw 3D foreground overlay (Photo & Video)
  if (settings.enable3dEffect) {
    if (settings.mode === 'photo') {
      if (fgImage) {
        ctx.drawImage(fgImage, drawX, drawY, drawW, drawH)
      }
    } else {
      if (tempMaskCanvas) {
        const fgCanvas = document.createElement('canvas')
        fgCanvas.width = cw
        fgCanvas.height = ch
        const fgCtx = fgCanvas.getContext('2d')!

        fgCtx.drawImage(bgSource, drawX, drawY, drawW, drawH)
        fgCtx.globalCompositeOperation = 'destination-in'
        fgCtx.drawImage(tempMaskCanvas, drawX, drawY, drawW, drawH)
        fgCtx.globalCompositeOperation = 'source-over'
        ctx.drawImage(fgCanvas, 0, 0)
      }
    }
  }
}

/**
 * React hook wrapper around pure frame rendering calculations,
 * keeping the exact same interface for UI components while preventing illegal hook calls.
 */
export function useLayout({
  settings,
  rowBounds,
  canvasSize,
  maskWidth,
  maskHeight,
  imageTransform,
  lyricLines = [],
  currentTime = 0,
  videoBounds = null,
}: Props) {

  // Get active frame's raw bounds if in video mode
  const activeVideoRowBounds = useMemo(() => {
    if (settings.mode !== 'video' || !videoBounds || videoBounds.length === 0) return null
    const fps = 15
    const frameIndex = Math.min(
      Math.max(0, Math.floor(currentTime * fps)),
      videoBounds.length - 1
    )
    return videoBounds[frameIndex]
  }, [settings.mode, videoBounds, currentTime])

  // Select appropriate raw bounds
  const currentRawBounds = settings.mode === 'video' ? activeVideoRowBounds : rowBounds

  // Memoize scaled bounds for photo mode preview
  const scaledBounds = useMemo(() => {
    if (!currentRawBounds || !maskWidth || !maskHeight) return null

    const { drawX, drawY, drawW, drawH } = computeImageRect(
      maskWidth, maskHeight,
      canvasSize.width, canvasSize.height,
      imageTransform
    )

    const imgScaled = scaleBounds(currentRawBounds, maskWidth, maskHeight, Math.round(drawW), Math.round(drawH))

    const left: number[] = new Array(canvasSize.height).fill(-1)
    const right: number[] = new Array(canvasSize.height).fill(-1)

    const cw = canvasSize.width
    const innerPadding = settings.innerPadding || 0
    const subjectOffset = settings.subjectOffset || 0

    for (let cy = 0; cy < canvasSize.height; cy++) {
      const iy = cy - Math.round(drawY)
      if (iy >= 0 && iy < imgScaled.left.length) {
        if (imgScaled.left[iy] !== -1) {
          const leftBoundary = imgScaled.left[iy] + Math.round(drawX)
          const rightBoundary = imgScaled.right[iy] + Math.round(drawX)

          left[cy] = Math.max(0, leftBoundary - innerPadding + subjectOffset)
          right[cy] = Math.min(cw, rightBoundary + innerPadding + subjectOffset)
        }
      }
    }

    return { left, right }
  }, [currentRawBounds, maskWidth, maskHeight, canvasSize, imageTransform, settings.innerPadding, settings.subjectOffset])

  // Memoize wrapped text lines for photo mode layout
  const classicLines = useMemo(() => {
    if (settings.mode !== 'photo' || !scaledBounds || !settings.content) return []
    return computeWrappedLines(null, settings.content, scaledBounds, canvasSize.width, canvasSize.height, settings)
  }, [settings.mode, settings, scaledBounds, canvasSize])

  // Hook-friendly useCallback wrapper around the pure renderer
  const renderFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    bgSource: HTMLImageElement | HTMLVideoElement,
    fgImage: HTMLImageElement | null,
    tempMaskCanvas?: HTMLCanvasElement,
    frameTime?: number
  ) => {
    renderFramePure(ctx, bgSource, fgImage, tempMaskCanvas, frameTime, {
      settings,
      rowBounds,
      canvasSize,
      maskWidth,
      maskHeight,
      imageTransform,
      lyricLines,
      currentTime,
      videoBounds,
    })
  }, [canvasSize, imageTransform, settings, lyricLines, currentTime, videoBounds, maskWidth, maskHeight, rowBounds])

  return { lines: classicLines, renderFrame, scaledBounds }
}
