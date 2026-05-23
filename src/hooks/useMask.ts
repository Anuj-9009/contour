import { useState, useCallback, useRef } from 'react'
import { AppState, RowBounds, ProcessingStage } from '../types'
import { extractBoundsFromImageData } from '../utils/bounds'

interface Props {
  setRowBounds: (b: RowBounds) => void
  setAppState: (s: AppState) => void
}

export function useMask({ setRowBounds, setAppState }: Props) {
  const [stage, setStage] = useState<ProcessingStage>({ label: '', progress: 0 })
  const foregroundRef = useRef<HTMLImageElement | null>(null)
  const maskDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  const processMask = useCallback(async (
    imageUrl: string,
    enableGpu: boolean = true,
    aiModel: 'isnet_fp16' | 'isnet_quint8' = 'isnet_fp16'
  ) => {
    try {
      setStage({ label: 'Loading AI model…', progress: 10 })

      // Dynamically import so the large WASM bundle is lazy-loaded
      const { removeBackground } = await import('@imgly/background-removal')

      setStage({ label: 'Detecting subject…', progress: 30 })

      let activeDevice: 'gpu' | 'cpu' = enableGpu ? 'gpu' : 'cpu'
      let blob: Blob
      
      try {
        const maskPromise = removeBackground(imageUrl, {
          model: aiModel,
          device: activeDevice,
          progress: (key: string, current: number, total: number) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0
            if (key.includes('fetch')) {
              setStage({ label: 'Downloading model…', progress: 10 + pct * 0.2 })
            } else if (key.includes('inference')) {
              setStage({ label: 'Analysing image…', progress: 30 + pct * 0.5 })
            }
          },
        })

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('GPU Processing Timeout')), 8000)
        })

        blob = await Promise.race([maskPromise, timeoutPromise])
      } catch (err: any) {
        console.warn('GPU Processing failed or timed out, falling back to CPU:', err)
        if (activeDevice === 'gpu') {
          activeDevice = 'cpu'
          setStage({ label: 'GPU failed. Retrying on CPU…', progress: 20 })
          
          blob = await removeBackground(imageUrl, {
            model: aiModel,
            device: 'cpu',
            progress: (key: string, current: number, total: number) => {
              const pct = total > 0 ? Math.round((current / total) * 100) : 0
              if (key.includes('fetch')) {
                setStage({ label: 'Downloading model (CPU fallback)…', progress: 10 + pct * 0.2 })
              } else if (key.includes('inference')) {
                setStage({ label: 'Analysing image (CPU fallback)…', progress: 30 + pct * 0.5 })
              }
            },
          })
        } else {
          throw err
        }
      }

      setStage({ label: 'Extracting silhouette…', progress: 85 })

      // Draw foreground onto offscreen canvas to read pixels
      const fgUrl = URL.createObjectURL(blob)
      const fgImg = new Image()
      
      await new Promise<void>((resolve, reject) => {
        fgImg.onload = () => resolve()
        fgImg.onerror = reject
        fgImg.src = fgUrl
      })

      foregroundRef.current = fgImg

      const offCanvas = document.createElement('canvas')
      offCanvas.width = fgImg.naturalWidth
      offCanvas.height = fgImg.naturalHeight
      maskDimensionsRef.current = { width: fgImg.naturalWidth, height: fgImg.naturalHeight }

      const ctx = offCanvas.getContext('2d')!
      ctx.drawImage(fgImg, 0, 0)
      const imageData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height)

      const bounds = extractBoundsFromImageData(imageData.data, offCanvas.width, offCanvas.height)

      setStage({ label: 'Done!', progress: 100 })
      setRowBounds(bounds)
      setAppState('ready')
    } catch (err) {
      console.error('Mask processing failed:', err)
      setStage({ label: 'Error – please try again.', progress: 0 })
      setAppState('empty')
    }
  }, [setRowBounds, setAppState])

  return { processMask, stage, foregroundRef, maskDimensionsRef }
}
