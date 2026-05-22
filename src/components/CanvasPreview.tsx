import { useRef, useEffect, useState, useCallback } from 'react'
import { TextSettings, CanvasSize, RowBounds, AppState, ImageTransform } from '../types'
import { useLayout } from '../hooks/useLayout'
import ExportButton from './ExportButton'

interface Props {
  imageUrl: string
  rowBounds: RowBounds
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
}

export default function CanvasPreview({
  imageUrl,
  rowBounds,
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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const [bgLoaded, setBgLoaded] = useState(false)
  const [displayScale, setDisplayScale] = useState(1)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Load background image
  useEffect(() => {
    const img = new Image()
    
    img.onload = () => {
      bgImageRef.current = img
      setBgLoaded(true)
    }
    img.src = imageUrl
  }, [imageUrl])

  // Compute display scale to fit the canvas in the viewport
  useEffect(() => {
    function computeScale() {
      if (!containerRef.current) return
      const containerW = containerRef.current.clientWidth - 60
      const containerH = containerRef.current.clientHeight - 100
      const scaleX = containerW / canvasSize.width
      const scaleY = containerH / canvasSize.height
      setDisplayScale(Math.min(scaleX, scaleY, 1))
    }
    computeScale()
    window.addEventListener('resize', computeScale)
    return () => window.removeEventListener('resize', computeScale)
  }, [canvasSize])

  const { renderFrame } = useLayout({
    settings,
    rowBounds,
    canvasSize,
    maskWidth,
    maskHeight,
    imageTransform,
  })

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    const bgImg = bgImageRef.current
    if (!canvas || !bgImg || !bgLoaded) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const ctx = canvas.getContext('2d')!
    renderFrame(ctx, bgImg, foregroundImage)
  }, [bgLoaded, canvasSize, renderFrame, foregroundImage])

  // Pan via mouse drag on the display canvas
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

  // Scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    const newScale = Math.max(0.5, Math.min(3, imageTransform.scale + delta))
    onImageTransformChange({ ...imageTransform, scale: newScale })
  }, [imageTransform, onImageTransformChange])

  // Export as PNG
  const handleExport = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onExportStart()

    // Small delay to update UI
    await new Promise((r) => setTimeout(r, 50))

    try {
      const link = document.createElement('a')
      link.download = `contour-${canvasSize.format.replace(':', 'x')}-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      onExportEnd()
    }
  }, [canvasSize, onExportStart, onExportEnd])

  return (
    <div className="canvas-area" ref={containerRef} id="canvas-area">
      <div className="canvas-area-bg" />
      <div
        className="canvas-container"
        style={{
          width: canvasSize.width * displayScale,
          height: canvasSize.height * displayScale,
        }}
      >
        <canvas
          ref={canvasRef}
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
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 10,
      }}>
        <ExportButton
          onClick={handleExport}
          loading={appState === 'exporting'}
        />
      </div>
    </div>
  )
}
