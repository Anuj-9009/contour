import { useRef, useEffect, useState, useCallback } from 'react'
import { TextSettings, CanvasSize, RowBounds, AppState, ImageTransform, LyricLine } from '../types'
import { useLayout } from '../hooks/useLayout'
import { decodeRLE } from '../utils/rle'
import ExportButton from './ExportButton'

interface Props {
  imageUrl: string | null
  videoUrl: string | null
  rowBounds: RowBounds | null
  videoBounds: RowBounds[] | null
  videoRleMasks: Uint32Array[] | null
  settings: TextSettings
  canvasSize: CanvasSize
  appState: AppState
  imageTransform: ImageTransform
  onImageTransformChange: (t: ImageTransform) => void
  onExportStart: () => void
  onExportEnd: () => void
  foregroundImage: HTMLImageElement | null
  maskWidth: number
  maskHeight: number
  lyricLines: LyricLine[]
  currentTime: number
  onTimeUpdate: (t: number) => void
  isPlaying: boolean
  onPlayToggle: (playing: boolean) => void
  duration: number
  videoFile: File | null
}

export default function CanvasPreview({
  imageUrl,
  videoUrl,
  rowBounds,
  videoBounds,
  videoRleMasks,
  settings,
  canvasSize,
  appState,
  imageTransform,
  onImageTransformChange,
  onExportStart,
  onExportEnd,
  foregroundImage,
  maskWidth,
  maskHeight,
  lyricLines,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayToggle,
  duration,
  videoFile,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Resources loaded states
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const [bgLoaded, setBgLoaded] = useState(false)
  const [displayScale, setDisplayScale] = useState(1)
  
  // HTML5 Video element ref for workspace playback
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  
  // RLE video mask decoder variables
  const tempMaskCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Load background image for photo mode
  useEffect(() => {
    if (settings.mode === 'photo' && imageUrl) {
      setBgLoaded(false)
      const img = new Image()
      img.onload = () => {
        bgImageRef.current = img
        setBgLoaded(true)
      }
      img.src = imageUrl
    }
  }, [imageUrl, settings.mode])

  // Setup video playback elements
  useEffect(() => {
    if (settings.mode === 'video' && videoUrl) {
      const video = document.createElement('video')
      video.src = videoUrl
      video.muted = false // Play audio during editing sync
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      videoRef.current = video

      const timeUpdateListener = () => {
        onTimeUpdate(video.currentTime)
      }
      const endedListener = () => {
        onPlayToggle(false)
      }

      video.addEventListener('timeupdate', timeUpdateListener)
      video.addEventListener('ended', endedListener)

      return () => {
        video.pause()
        video.removeEventListener('timeupdate', timeUpdateListener)
        video.removeEventListener('ended', endedListener)
        videoRef.current = null
      }
    }
  }, [videoUrl, settings.mode, onTimeUpdate, onPlayToggle])

  // Handle playing state
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.play().catch(err => console.log('Video play error:', err))
    } else {
      video.pause()
    }
  }, [isPlaying])

  // Compute display scale to fit the canvas in the viewport
  useEffect(() => {
    function computeScale() {
      if (!containerRef.current) return
      const containerW = containerRef.current.clientWidth - 48
      const containerH = containerRef.current.clientHeight - 148 // leave gap for scrubber bar
      const scaleX = containerW / canvasSize.width
      const scaleY = containerH / canvasSize.height
      setDisplayScale(Math.min(scaleX, scaleY, 1))
    }
    computeScale()
    window.addEventListener('resize', computeScale)
    return () => window.removeEventListener('resize', computeScale)
  }, [canvasSize])

  // Upgraded typesetter compositor hook
  const { renderFrame } = useLayout({
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

  // Capture latest renderFrame via Ref to prevent tearing down the requestAnimationFrame loop
  const renderFrameRef = useRef(renderFrame)
  useEffect(() => {
    renderFrameRef.current = renderFrame
  }, [renderFrame])

  // Trigger redraw in photo mode when layout changes (such as sliders/offsets/transforms/image load)
  useEffect(() => {
    if (settings.mode === 'photo') {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const bgImg = bgImageRef.current
      if (ctx && bgImg && bgLoaded) {
        renderFrame(ctx, bgImg, foregroundImage)
      }
    }
  }, [settings.mode, renderFrame, bgLoaded, foregroundImage])

  // Render loop
  useEffect(() => {
    let animId: number
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const ctx = canvas.getContext('2d')!

    const tick = () => {
      if (settings.mode === 'photo') {
        const bgImg = bgImageRef.current
        if (bgImg && bgLoaded) {
          renderFrameRef.current(ctx, bgImg, foregroundImage)
        }
      } else {
        const video = videoRef.current
        if (video) {
          const frameTime = video.currentTime
          // If enabled, decode current frame's RLE mask
          let tempMaskCanvas: HTMLCanvasElement | undefined
          if (settings.enable3dEffect && videoRleMasks && videoRleMasks.length > 0) {
            const fps = 15
            const frameIdx = Math.min(
              Math.max(0, Math.floor(frameTime * fps)),
              videoRleMasks.length - 1
            )
            const runs = videoRleMasks[frameIdx]

            if (runs) {
              if (!tempMaskCanvasRef.current) {
                const c = document.createElement('canvas')
                c.width = 180
                c.height = 320
                tempMaskCanvasRef.current = c
              }
              const mc = tempMaskCanvasRef.current
              const mCtx = mc.getContext('2d')!
              
              // Decode masks directly into alpha pixels (< 0.2ms)
              const binary = decodeRLE(runs, 180 * 320)
              const mData = mCtx.createImageData(180, 320)
              for (let i = 0; i < binary.length; i++) {
                const a = binary[i] === 1 ? 255 : 0
                mData.data[i * 4] = 0
                mData.data[i * 4 + 1] = 0
                mData.data[i * 4 + 2] = 0
                mData.data[i * 4 + 3] = a
              }
              mCtx.putImageData(mData, 0, 0)
              tempMaskCanvas = mc
            }
          }

          renderFrameRef.current(ctx, video, null, tempMaskCanvas, frameTime)
        }
      }

      // Request next frame in video mode to support 60 FPS scrolling physics
      if (settings.mode === 'video') {
        animId = requestAnimationFrame(tick)
      }
    }

    tick()

    return () => {
      if (animId) cancelAnimationFrame(animId)
    }
  }, [bgLoaded, canvasSize, foregroundImage, settings.mode, settings.enable3dEffect, videoRleMasks])

  // Drag controls for pan/zoom
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: imageTransform.x,
      origY: imageTransform.y,
    }
  }, [imageTransform])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const dx = (e.clientX - dragRef.current.startX) / displayScale
      const dy = (e.clientY - dragRef.current.startY) / displayScale
      onImageTransformChange({
        ...imageTransform,
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      })
    }
    function handleMouseUp() {
      dragRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [imageTransform, displayScale, onImageTransformChange])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    const newScale = Math.max(0.5, Math.min(3, imageTransform.scale + delta))
    onImageTransformChange({ ...imageTransform, scale: newScale })
  }, [imageTransform, onImageTransformChange])

  // Scrubber seeker jump
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    const video = videoRef.current
    if (video) {
      video.currentTime = val
      onTimeUpdate(val)
    }
  }

  // Format time label (e.g. 00:14)
  const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // Multi-frame exporting triggers
  const handleExport = useCallback(() => {
    onExportStart()
  }, [onExportStart])

  // Render dummy visualizer bars
  const visualizerBars = Array.from({ length: 48 }, (_, i) => {
    // Generate organic wave heights
    const h = 5 + Math.sin(i * 0.4) * 15 + Math.cos(i * 0.15) * 10
    return Math.max(4, Math.min(32, h))
  })

  return (
    <div className="canvas-area flex-1 flex flex-col items-center justify-between p-6 relative overflow-hidden bg-slate-100 dark:bg-slate-950" ref={containerRef} id="canvas-area">
      <div className="canvas-area-bg absolute inset-0 opacity-[0.03] pointer-events-none" />
      
      {/* ─── Canvas Render Composition View ─── */}
      <div
        className="canvas-container flex-1 flex items-center justify-center relative select-none"
        style={{
          width: canvasSize.width * displayScale,
          height: canvasSize.height * displayScale,
        }}
      >
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-2xl border border-slate-200/50 dark:border-slate-800/50 transition-shadow duration-300"
          style={{
            width: canvasSize.width * displayScale,
            height: canvasSize.height * displayScale,
            cursor: 'grab',
          }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          id="preview-canvas"
        />
      </div>

      {/* ─── Bottom Glassmorphic Scrubbing Scrubber bar (Video mode only) ─── */}
      {settings.mode === 'video' && videoUrl && (
        <div className="w-full max-w-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-full px-5 py-3 shadow-lg flex items-center gap-4 mt-6">
          {/* Play/Pause Button */}
          <button
            onClick={() => onPlayToggle(!isPlaying)}
            className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center hover:scale-105 hover:bg-[#0056D2] transition-all shadow-md flex-shrink-0"
          >
            <span className="material-symbols-outlined text-xl">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Time tracker labels */}
          <span className="text-xs font-semibold text-slate-500 font-label flex-shrink-0">
            {formatTime(currentTime)}
          </span>

          {/* Audio Waveform Seeker slider */}
          <div className="flex-1 flex items-center relative group py-2">
            <div className="absolute inset-0 flex items-center justify-between gap-[3px] pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity">
              {visualizerBars.map((val, idx) => {
                // Color active vs inactive bars
                const barPercent = (idx / visualizerBars.length) * duration
                const isActive = barPercent <= currentTime
                return (
                  <div
                    key={idx}
                    className={`w-0.5 rounded-full transition-all duration-300`}
                    style={{
                      height: `${val}px`,
                      backgroundColor: isActive ? '#0f62fe' : 'currentColor',
                    }}
                  />
                )
              })}
            </div>
            
            <input
              type="range"
              min={0}
              max={duration || 10}
              step={0.01}
              value={currentTime}
              onChange={handleScrubberChange}
              className="w-full h-8 opacity-0 cursor-pointer relative z-10"
            />
          </div>

          <span className="text-xs font-semibold text-slate-400 font-label flex-shrink-0">
            {formatTime(duration)}
          </span>

          {/* Mute Volume status indicator */}
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !videoRef.current.muted
              }
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              volume_up
            </span>
          </button>
        </div>
      )}

      {/* Floating Export Action trigger */}
      <div className="absolute bottom-6 right-6 z-30">
        <ExportButton
          onClick={handleExport}
          loading={appState === 'exporting'}
          mode={settings.mode}
          videoFile={videoFile}
          canvasRef={canvasRef}
          videoRleMasks={videoRleMasks}
          lyricLines={lyricLines}
          canvasSize={canvasSize}
          duration={duration}
          settings={settings}
          onExportStart={onExportStart}
          onExportEnd={onExportEnd}
          videoBounds={videoBounds}
          rowBounds={rowBounds}
          imageTransform={imageTransform}
          maskWidth={maskWidth}
          maskHeight={maskHeight}
          foregroundImage={foregroundImage}
          backgroundImage={bgImageRef.current}
        />

      </div>
    </div>
  )
}
