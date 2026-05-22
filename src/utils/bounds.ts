import { RowBounds } from '../types'

/**
 * Scale raw mask row-bounds from mask dimensions to canvas dimensions.
 * Uses nearest-neighbour sampling for each canvas row.
 */
export function scaleBounds(
  bounds: RowBounds,
  maskWidth: number,
  maskHeight: number,
  canvasWidth: number,
  canvasHeight: number
): RowBounds {
  const left: number[] = new Array(canvasHeight)
  const right: number[] = new Array(canvasHeight)
  const scaleX = canvasWidth / maskWidth
  const scaleY = canvasHeight / maskHeight

  for (let cy = 0; cy < canvasHeight; cy++) {
    const my = Math.min(Math.floor(cy / scaleY), maskHeight - 1)
    // If there is no subject at this row, mark full-width availability
    if (bounds.left[my] === -1 || bounds.right[my] === -1) {
      left[cy] = -1
      right[cy] = -1
    } else {
      left[cy] = Math.floor(bounds.left[my] * scaleX)
      right[cy] = Math.floor(bounds.right[my] * scaleX)
    }
  }

  return { left, right }
}

/**
 * Extract row-level left/right subject boundaries from mask ImageData.
 * Scans each row for the first and last non-transparent pixel.
 */
export function extractBoundsFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): RowBounds {
  const left: number[] = new Array(height)
  const right: number[] = new Array(height)

  for (let y = 0; y < height; y++) {
    let l = -1
    let r = -1
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 15) {
        if (l === -1) l = x
        r = x
      }
    }
    left[y] = l
    right[y] = r
  }

  return { left, right }
}
