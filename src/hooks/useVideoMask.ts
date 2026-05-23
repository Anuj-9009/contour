import { useState, useCallback, useRef } from 'react'
import { RowBounds, ProcessingStage } from '../types'
import { encodeRLE } from '../utils/rle'
import { extractBoundsFromImageData } from '../utils/bounds'

interface Props {
  onVideoBoundsLoaded: (bounds: RowBounds[]) => void
  onVideoFramesCached: (rleMasks: Uint32Array[]) => void
}

export function useVideoMask({ onVideoBoundsLoaded, onVideoFramesCached }: Props) {
  const [stage, setStage] = useState<ProcessingStage>({ label: '', progress: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const isCancelledRef = useRef(false)

  const cancelVideoProcessing = useCallback(() => {
    isCancelledRef.current = true
    setIsProcessing(false)
    setStage({ label: 'Cancelled', progress: 0 })
  }, [])

  const processVideoMasks = useCallback(async (
    videoUrl: string,
    duration: number,
    enableGpu: boolean = true,
    aiModel: 'isnet_fp16' | 'isnet_quint8' = 'isnet_fp16'
  ) => {
    setIsProcessing(true)
    isCancelledRef.current = false
    setStage({ label: 'Initializing AI Model...', progress: 5 })

    try {
      // 1. Preload @imgly/background-removal
      const { removeBackground } = await import('@imgly/background-removal')

      // 2. Platform-based Dynamic Multi-Lane Setup (Desktop: 3 lanes, Mobile: 1 lane)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
      )
      const numLanes = isMobile ? 1 : 3

      // 3. Frame Sampling Setup: 15 FPS output, but AI processes at 5 FPS (every 3rd frame)
      const maxDuration = Math.min(duration, 30) // cap at 30s
      const outputFps = 15
      const aiFps = 5
      const sampleStride = outputFps / aiFps // = 3 (processes indices 0, 3, 6...)
      const frameStep = 1 / outputFps
      const totalFrames = Math.floor(maxDuration * outputFps)

      // Identify all targeted AI keyframe indices f
      const aiFrameIndices: number[] = []
      for (let f = 0; f < totalFrames; f++) {
        const isAiFrame = f % sampleStride === 0 || f === totalFrames - 1
        if (isAiFrame) {
          aiFrameIndices.push(f)
        }
      }
      const totalAiFrames = aiFrameIndices.length

      // Split targeted AI frames into uniform contiguous temporal chunks
      const chunks: number[][] = Array.from({ length: numLanes }, () => [])
      for (let i = 0; i < aiFrameIndices.length; i++) {
        const chunkIndex = Math.min(Math.floor((i * numLanes) / aiFrameIndices.length), numLanes - 1)
        chunks[chunkIndex].push(aiFrameIndices[i])
      }

      const tempBounds: Record<number, RowBounds> = {}
      const tempRles: Record<number, Uint32Array> = {}
      const completedRef = { count: 0 }

      // Downscaled resolution boundaries for processing (maintains fluid memory footprint)
      const downWidth = 180
      const downHeight = 320

      // Pre-warm / pre-download the model sequentially first to prevent concurrent download race conditions!
      setStage({ label: 'Initializing AI Model...', progress: 6 })
      let activeDevice: 'gpu' | 'cpu' = enableGpu ? 'gpu' : 'cpu'
      try {
        const dummyCanvas = document.createElement('canvas')
        dummyCanvas.width = 1
        dummyCanvas.height = 1
        const dummyBlob = await new Promise<Blob>((res) => dummyCanvas.toBlob(b => res(b!), 'image/png'))
        
        const warmPromise = removeBackground(dummyBlob, {
          model: aiModel,
          device: activeDevice,
          progress: (key: string, current: number, total: number) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0
            if (key.includes('fetch')) {
              setStage({ label: `Downloading AI weights (${pct}%)...`, progress: 6 + pct * 0.04 })
            } else {
              setStage({ label: `Initializing engine...`, progress: 10 })
            }
          }
        })

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('GPU Pre-warming Timeout')), 7000)
        })

        await Promise.race([warmPromise, timeoutPromise])
      } catch (err) {
        console.warn('GPU pre-warming failed or timed out, falling back to CPU:', err)
        if (activeDevice === 'gpu') {
          activeDevice = 'cpu'
          setStage({ label: 'GPU init timed out. Falling back to CPU...', progress: 9 })
          try {
            const dummyCanvas = document.createElement('canvas')
            dummyCanvas.width = 1
            dummyCanvas.height = 1
            const dummyBlob = await new Promise<Blob>((res) => dummyCanvas.toBlob(b => res(b!), 'image/png'))
            await removeBackground(dummyBlob, {
              model: aiModel,
              device: 'cpu',
              progress: (key: string, current: number, total: number) => {
                const pct = total > 0 ? Math.round((current / total) * 100) : 0
                if (key.includes('fetch')) {
                  setStage({ label: `Downloading AI weights (CPU fallback) (${pct}%)...`, progress: 9 + pct * 0.01 })
                } else {
                  setStage({ label: `Initializing engine (CPU)...`, progress: 10 })
                }
              }
            })
          } catch (cpuErr) {
            console.error('CPU pre-warming failed:', cpuErr)
          }
        }
      }

      setStage({ label: 'Extracting video frames...', progress: 10 })

      const extractedFrames: Record<number, ImageData> = {}

      // Define parallel lane worker execution for seeking and frame extraction
      const runExtractionLane = async (laneIndex: number, frameIndices: number[]) => {
        if (frameIndices.length === 0) return

        // Create lane-specific offscreen video element for concurrent seeking & decoding
        const video = document.createElement('video')
        video.src = videoUrl
        video.muted = true
        video.playsInline = true
        video.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve()
          video.onerror = () => reject(new Error(`Failed to load video in lane ${laneIndex}`))
        })

        // Create lane-specific offscreen canvas to avoid drawing race conditions
        const canvas = document.createElement('canvas')
        canvas.width = downWidth
        canvas.height = downHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!

        for (const f of frameIndices) {
          if (isCancelledRef.current) {
            break
          }

          try {
            const currentTime = f * frameStep
            video.currentTime = currentTime

            // Wait for sequential seeking to finish on this lane's player
            await new Promise<void>((resolve) => {
              video.onseeked = () => {
                video.onseeked = null
                resolve()
              }
            })

            // Draw current frame to lane canvas
            ctx.clearRect(0, 0, downWidth, downHeight)
            ctx.drawImage(video, 0, 0, downWidth, downHeight)
            
            // Cache the raw frame image data (only ~230KB per frame!)
            extractedFrames[f] = ctx.getImageData(0, 0, downWidth, downHeight)
          } catch (frameErr) {
            console.error(`Lane ${laneIndex} failed extracting frame index ${f}:`, frameErr)
          }
        }

        // Clean up lane video player memory instantly
        video.src = ''
        video.load()
      }

      // Execute all active lanes concurrently to seek and extract frames in parallel
      const lanePromises = chunks.map((chunk, idx) => runExtractionLane(idx, chunk))
      await Promise.all(lanePromises)

      if (isCancelledRef.current) {
        setIsProcessing(false)
        return
      }

      // 2. Sequential AI Processing Phase (avoids concurrency deadlocks in shared ONNX context)
      setStage({ label: 'Analysing video frames...', progress: 15 })

      // Create a single offscreen canvas for mask reading
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = downWidth
      maskCanvas.height = downHeight
      const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!

      let processedCount = 0

      for (const f of aiFrameIndices) {
        if (isCancelledRef.current) {
          break
        }

        const imgData = extractedFrames[f]
        if (!imgData) continue

        try {
          // Convert cached ImageData to Blob on-the-fly sequentially
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = downWidth
          tempCanvas.height = downHeight
          tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0)
          
          const blobInput = await new Promise<Blob>((resolveBlob, rejectBlob) => {
            tempCanvas.toBlob((b) => {
              if (b) resolveBlob(b)
              else rejectBlob(new Error('Canvas toBlob failed'))
            }, 'image/png')
          })

          // Run client-side subject detection SEQUENTIALLY
          const maskBlob = await removeBackground(blobInput, {
            model: aiModel,
            device: activeDevice,
            progress: () => {} // silence logging to avoid main thread spam
          })

          if (isCancelledRef.current) break

          // High performance off-thread image bitmap compilation
          const imageBitmap = await createImageBitmap(maskBlob)

          // Render mask back to canvas to read boundary data
          maskCtx.clearRect(0, 0, downWidth, downHeight)
          maskCtx.drawImage(imageBitmap, 0, 0, downWidth, downHeight)
          imageBitmap.close() // release native graphics memory instantly

          const maskImgData = maskCtx.getImageData(0, 0, downWidth, downHeight)

          // Compile binary mask (0 for background, 1 for subject)
          const binaryMask = new Uint8Array(downWidth * downHeight)
          for (let i = 0; i < maskImgData.data.length / 4; i++) {
            binaryMask[i] = maskImgData.data[i * 4 + 3] > 15 ? 1 : 0
          }

          // Compress mask using Run-Length Encoding
          tempRles[f] = encodeRLE(binaryMask)

          // Extract contour boundaries
          tempBounds[f] = extractBoundsFromImageData(maskImgData.data, downWidth, downHeight)
        } catch (frameErr) {
          console.error(`Sequential AI failed processing frame index ${f}:`, frameErr)
        } finally {
          // Update unified progress sequentially
          processedCount++
          const pct = Math.round(15 + (processedCount / totalAiFrames) * 85)
          setStage({
            label: `Analysing frame ${processedCount} of ${totalAiFrames}...`,
            progress: pct
          })
        }
      }

      // --- Reconstruction & Interpolation Phase ---
      const boundsCache: RowBounds[] = []
      const rleMasksCache: Uint32Array[] = []
      const fallbackBounds = { left: new Array(downHeight).fill(0), right: new Array(downHeight).fill(downWidth) }

      for (let f = 0; f < totalFrames; f++) {
        if (tempBounds[f]) {
          // Exact matches for AI-sampled keyframes
          boundsCache.push(tempBounds[f])
          rleMasksCache.push(tempRles[f])
        } else {
          // Reconstruct intermediate frames via linear boundary interpolation
          const prevKey = f - (f % sampleStride)
          let nextKey = prevKey + sampleStride
          if (nextKey >= totalFrames) nextKey = totalFrames - 1

          const prevBounds = tempBounds[prevKey] || Object.values(tempBounds)[0] || fallbackBounds
          const nextBounds = tempBounds[nextKey] || prevBounds

          const w = (f - prevKey) / (nextKey - prevKey || 1)

          // Linearly interpolate left and right boundaries point-by-point
          const interpolatedLeft = prevBounds.left.map((val, idx) =>
            Math.round(val * (1 - w) + (nextBounds.left[idx] ?? val) * w)
          )
          const interpolatedRight = prevBounds.right.map((val, idx) =>
            Math.round(val * (1 - w) + (nextBounds.right[idx] ?? val) * w)
          )

          boundsCache.push({ left: interpolatedLeft, right: interpolatedRight })

          // Propagate nearest keyframe's binary mask (Nearest Neighbor)
          const nearestKey = w < 0.5 ? prevKey : nextKey
          rleMasksCache.push(tempRles[nearestKey] || tempRles[prevKey] || new Uint32Array(0))
        }
      }

      onVideoBoundsLoaded(boundsCache)
      onVideoFramesCached(rleMasksCache)
      setStage({ label: 'Analysis complete!', progress: 100 })
      setIsProcessing(false)
    } catch (err: any) {
      console.error('Video segmentation failed:', err)
      setStage({ label: 'Analysis failed. Please retry.', progress: 0 })
      setIsProcessing(false)
    }
  }, [onVideoBoundsLoaded, onVideoFramesCached])

  return {
    processVideoMasks,
    isProcessing,
    stage,
    cancelVideoProcessing
  }
}
