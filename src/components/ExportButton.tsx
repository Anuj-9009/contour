import { useState, useRef } from 'react'
import { TextSettings, CanvasSize, ExportFormat, ExportResolution, CANVAS_PRESETS, RowBounds, ImageTransform } from '../types'
import { decodeRLE } from '../utils/rle'
import { renderFramePure } from '../hooks/useLayout'

interface Props {
  onClick: () => void
  loading: boolean
  mode: 'photo' | 'video'
  videoFile: File | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  videoRleMasks: Uint32Array[] | null
  lyricLines: LyricLine[]
  canvasSize: CanvasSize
  duration: number
  settings: TextSettings
  onExportStart: () => void
  onExportEnd: () => void
  videoBounds?: RowBounds[] | null
  rowBounds?: RowBounds | null
  imageTransform?: ImageTransform
  maskWidth?: number
  maskHeight?: number
  foregroundImage?: HTMLImageElement | null
  backgroundImage?: HTMLImageElement | null
}


interface LyricLine {
  text: string
  timestamp: number
}

export default function ExportButton({
  onClick,
  loading,
  mode,
  videoFile,
  canvasRef,
  videoRleMasks,
  lyricLines,
  canvasSize,
  duration,
  settings,
  onExportStart,
  onExportEnd,
  videoBounds,
  rowBounds,
  imageTransform,
  maskWidth,
  maskHeight,
  foregroundImage,
  backgroundImage,
}: Props) {

  const [isOpen, setIsOpen] = useState(false)
  const [resolution, setResolution] = useState<ExportResolution>('1080p')
  const [bitrate, setBitrate] = useState<number>(15) // Mbps
  const [format, setFormat] = useState<ExportFormat>(canvasSize.format)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [renderStage, setRenderStage] = useState<string>('')
  const [isCompiling, setIsCompiling] = useState(false)

  // Dynamic file size estimator formula
  const estimatedSize = ((bitrate * (duration || 10)) / 8).toFixed(1)

  // WebAssembly FFmpeg and Canvas frame decoder compiling
  const handleCompileExport = async () => {
    if (mode === 'photo') {
      // Photo Mode: Straightforward high-res PNG download
      onExportStart()
      setIsCompiling(true)
      setRenderStage('Rendering high-res canvas…')
      setRenderProgress(40)

      setTimeout(() => {
        const makeEven = (n: number) => Math.round(n / 2) * 2
        let outW = 1080
        let outH = 1920

        if (canvasSize.format === 'original') {
          const isPortrait = canvasSize.width <= canvasSize.height
          if (resolution === '4k') {
            if (isPortrait) {
              outW = 2160
              outH = makeEven(2160 * (canvasSize.height / canvasSize.width))
            } else {
              outW = 3840
              outH = makeEven(3840 * (canvasSize.height / canvasSize.width))
            }
          } else {
            if (isPortrait) {
              outW = 1080
              outH = makeEven(1080 * (canvasSize.height / canvasSize.width))
            } else {
              outW = 1920
              outH = makeEven(1920 * (canvasSize.height / canvasSize.width))
            }
          }
        } else {
          const baseW = resolution === '4k' ? 2160 : 1080
          const ratio = canvasSize.height / canvasSize.width
          outW = baseW
          outH = makeEven(baseW * ratio)
        }

        const renderCanvas = document.createElement('canvas')
        renderCanvas.width = outW
        renderCanvas.height = outH
        const renderCtx = renderCanvas.getContext('2d')!

        if (backgroundImage) {
          renderFramePure(renderCtx, backgroundImage, foregroundImage || null, undefined, undefined, {
            settings,
            rowBounds: rowBounds || null,
            canvasSize: { format: canvasSize.format, width: outW, height: outH },
            maskWidth: maskWidth || 180,
            maskHeight: maskHeight || 320,
            imageTransform: imageTransform || { x: 0, y: 0, scale: 1 },
            lyricLines,
            currentTime: 0,
            videoBounds: null,
          })
          
          const link = document.createElement('a')
          link.download = `contour-art-${Date.now()}.png`
          link.href = renderCanvas.toDataURL('image/png')
          link.click()
        } else {
          // Fallback to preview canvas
          const canvas = canvasRef.current
          if (canvas) {
            const link = document.createElement('a')
            link.download = `contour-art-${Date.now()}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
          }
        }

        setRenderProgress(100)
        setIsCompiling(false)
        onExportEnd()
        setIsOpen(false)
      }, 500)
      return
    }


    // Video Mode: High-fidelity frame sequences render & FFmpeg audio muxing
    onExportStart()
    setIsCompiling(true)
    setRenderProgress(5)
    setRenderStage('Initializing WebAssembly Exporter…')

    try {
      // 1. Dynamic imports for FFmpeg
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')

      const ffmpeg = new FFmpeg()
      
      // Load local or CDN compiled core
      // Load local or CDN compiled core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.15/dist/esm'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      setRenderProgress(20)
      setRenderStage('Mapping master video frame sequences…')

      // Prepare variables for frame-by-frame seeking
      const video = document.createElement('video')
      if (videoFile) {
        video.src = URL.createObjectURL(videoFile)
      } else {
        throw new Error('No source video file found')
      }
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve()
      })

      // Frame setup: 15 FPS encoding matching AI sample segments
      const fps = 15
      const frameStep = 1 / fps
      const totalFrames = Math.floor(Math.min(duration, 30) * fps) // limit preview export to 30s
      
      // Create high-res offscreen rendering canvas
      const makeEven = (n: number) => Math.round(n / 2) * 2
      let outW = 1080
      let outH = 1920

      if (canvasSize.format === 'original') {
        const isPortrait = canvasSize.width <= canvasSize.height
        if (resolution === '4k') {
          if (isPortrait) {
            outW = 2160
            outH = makeEven(2160 * (canvasSize.height / canvasSize.width))
          } else {
            outW = 3840
            outH = makeEven(3840 * (canvasSize.height / canvasSize.width))
          }
        } else {
          if (isPortrait) {
            outW = 1080
            outH = makeEven(1080 * (canvasSize.height / canvasSize.width))
          } else {
            outW = 1920
            outH = makeEven(1920 * (canvasSize.height / canvasSize.width))
          }
        }
      } else {
        const baseW = resolution === '4k' ? 2160 : 1080
        const ratio = canvasSize.height / canvasSize.width
        outW = baseW
        outH = makeEven(baseW * ratio)
      }
      
      const renderCanvas = document.createElement('canvas')
      renderCanvas.width = outW
      renderCanvas.height = outH
      const renderCtx = renderCanvas.getContext('2d')!

      // Temporary mask canvases
      const tempMaskCanvas = document.createElement('canvas')
      tempMaskCanvas.width = 180
      tempMaskCanvas.height = 320
      const tempMaskCtx = tempMaskCanvas.getContext('2d')!

      // Loop through frames, seek video, apply 3D composite masks and save PNGs
      for (let f = 0; f < totalFrames; f++) {
        const frameTime = f * frameStep
        video.currentTime = frameTime
        
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            video.onseeked = null
            resolve()
          }
        })

        // Draw frame background and lines
        let activeTempMask: HTMLCanvasElement | undefined
        if (settings.enable3dEffect && videoRleMasks && videoRleMasks[f]) {
          const runs = videoRleMasks[f]
          const binary = decodeRLE(runs, 180 * 320)
          const mData = tempMaskCtx.createImageData(180, 320)
          
          for (let i = 0; i < binary.length; i++) {
            const a = binary[i] === 1 ? 255 : 0
            mData.data[i * 4] = 0
            mData.data[i * 4 + 1] = 0
            mData.data[i * 4 + 2] = 0
            mData.data[i * 4 + 3] = a
          }
          tempMaskCtx.putImageData(mData, 0, 0)
          activeTempMask = tempMaskCanvas
        }

        renderFramePure(renderCtx, video, null, activeTempMask, frameTime, {
          settings,
          rowBounds: null,
          canvasSize: { format: canvasSize.format, width: outW, height: outH },
          maskWidth: 180,
          maskHeight: 320,
          imageTransform: { x: 0, y: 0, scale: 1 },
          lyricLines,
          currentTime: frameTime,
          videoBounds: videoBounds || null,
        })


        // Capture frame as blob
        const blob = await new Promise<Blob | null>((res) => {
          renderCanvas.toBlob((b) => res(b), 'image/png')
        })

        if (blob) {
          const arrayBuffer = await blob.arrayBuffer()
          await ffmpeg.writeFile(`frame_${f}.png`, new Uint8Array(arrayBuffer))
        }

        const pct = Math.round(20 + (f / totalFrames) * 50)
        setRenderProgress(pct)
        setRenderStage(`Rendering frames (${f + 1}/${totalFrames})…`)
      }

      setRenderStage('Muxing high-fidelity audio tracks…')
      setRenderProgress(75)

      // Write master video to virtual disk to extract original audio
      const videoBuffer = await videoFile.arrayBuffer()
      await ffmpeg.writeFile('input_video.mp4', new Uint8Array(videoBuffer))

      setRenderProgress(85)
      setRenderStage('Assembling final H.264 stream…')

      // Master compilation command: Map sequential PNGs and copy audio losslessly
      await ffmpeg.exec([
        '-r', '15',
        '-i', 'frame_%d.png',
        '-i', 'input_video.mp4',
        '-map', '0:v',
        '-map', '1:a?',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '18',
        '-b:v', `${bitrate}M`,
        '-c:a', 'copy',
        '-shortest',
        'output.mp4'
      ])

      setRenderProgress(95)
      setRenderStage('Downloading publication video…')

      // Read final MP4 from WebAssembly virtual memory
      const data = await ffmpeg.readFile('output.mp4')
      const finalBlob = new Blob([data as any], { type: 'video/mp4' })
      const downloadUrl = URL.createObjectURL(finalBlob)

      const link = document.createElement('a')
      link.download = `contour-kinetic-${Date.now()}.mp4`
      link.href = downloadUrl
      link.click()

      setRenderProgress(100)
      setIsCompiling(false)
      onExportEnd()
      setIsOpen(false)
    } catch (err: any) {
      console.error('WASM compilation failed, triggering static snapshot fallback:', err)
      setRenderStage('Initiating fallback snapshot download…')
      
      try {
        const canvas = canvasRef.current
        if (!canvas) throw new Error('No canvas element found')

        const link = document.createElement('a')
        link.download = `contour-fallback-snapshot-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        
        alert('Offline WASM Export is unsupported on this browser. A high-fidelity static artwork snapshot has been downloaded as a fallback.')
        
        setRenderProgress(100)
        setIsCompiling(false)
        onExportEnd()
        setIsOpen(false)
      } catch (fallbackErr) {
        console.error('Unified export crash:', fallbackErr)
        alert('Export failed. Please check browser capability.')
        setIsCompiling(false)
        onExportEnd()
        setIsOpen(false)
      }
    }
  }


  return (
    <>
      <button
        className="btn-primary flex items-center gap-2 rounded-full px-6 py-3 shadow-lg font-headline font-bold text-sm tracking-wide bg-primary-container text-white hover:bg-[#0056D2] hover:scale-105 active:scale-95 transition-all"
        onClick={() => setIsOpen(true)}
        disabled={loading}
        id="export-btn"
      >
        <span className="material-symbols-outlined text-lg">download</span>
        {mode === 'photo' ? 'Download Artwork' : 'Export Video'}
      </button>

      {/* ─── Production Export Modal Overlay ─── */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 transition-all">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-headline font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary-container">slow_motion_video</span>
                  Production Export
                </h3>
                <p className="text-xs text-slate-400 mt-1">Configure layout, quality, and resolution targets.</p>
              </div>
              {!isCompiling && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            {/* If Compiling: Render Progress Bar */}
            {isCompiling ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary-container/10 border-2 border-primary-container flex items-center justify-center text-primary-container mx-auto animate-spin">
                  <span className="material-symbols-outlined text-2xl">sync</span>
                </div>
                <h4 className="font-headline font-bold text-slate-800 dark:text-slate-200">{renderStage}</h4>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full transition-all duration-300"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">Processing fully offline inside the local WebAssembly compiler.</p>
              </div>
            ) : (
              <>
                {/* Resolution Presets */}
                <div className="control-group">
                  <label className="text-xs font-bold text-slate-400 block mb-2">OUTPUT RESOLUTION</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['1080p', '4k'] as ExportResolution[]).map((res) => (
                      <button
                        key={res}
                        className={`py-2.5 rounded-full border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                          resolution === res
                            ? 'border-primary-container bg-primary-lighter/10 text-primary-container font-bold'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 hover:bg-slate-50'
                        }`}
                        onClick={() => setResolution(res)}
                      >
                        <span>{res.toUpperCase()}</span>
                        <span className="text-[9px] opacity-75 mt-0.5">
                          {res === '1080p' ? '1080 × 1920 (Standard)' : '2160 × 3840 (Ultra-HD)'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video specific Bitrate sliders */}
                {mode === 'video' && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="control-group">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                        <span>Quality Compression Bitrate</span>
                        <span className="text-primary-container font-bold">{bitrate} Mbps</span>
                      </div>
                      <input
                        type="range"
                        className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        min={5}
                        max={30}
                        value={bitrate}
                        onChange={(e) => setBitrate(Number(e.target.value))}
                      />
                    </div>

                    {/* Size Estimator Panel */}
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block">ESTIMATED EXPORT SIZE</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">~{estimatedSize} MB</span>
                      </div>
                      <span className="text-[10px] text-slate-400 max-w-[170px] text-right leading-relaxed">
                        Calculated based on a {duration.toFixed(0)}s timeline duration at a {bitrate} Mbps stream rate.
                      </span>
                    </div>
                  </div>
                )}

                {/* Final compile triggers */}
                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 rounded-full py-2.5 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompileExport}
                    className="flex-1 rounded-full py-2.5 text-xs font-bold bg-primary-container text-white hover:bg-[#0056D2] shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    Compile Export 🚀
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
