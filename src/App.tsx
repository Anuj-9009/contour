import { useState, useCallback } from 'react'
import { AppState, TextSettings, CanvasSize, RowBounds, ImageTransform } from './types'
import Dropzone from './components/Dropzone'
import ControlsPanel from './components/ControlsPanel'
import CanvasPreview from './components/CanvasPreview'
import { useMask } from './hooks/useMask'

const DEFAULT_SETTINGS: TextSettings = {
  content: 'Your text here. Type anything and watch it flow around the subject of your image like a magazine cover.',
  fontFamily: 'Inter',
  fontSize: 36,
  lineHeight: 48,
  color: '#ffffff',
  side: 'left',
  alignment: 'left',
  overlayOpacity: 0.15,
  enable3dEffect: true,
  textStartY: 60,
  padding: 40,
}

const DEFAULT_CANVAS: CanvasSize = {
  format: '1:1',
  width: 1080,
  height: 1080,
}

const DEFAULT_TRANSFORM: ImageTransform = {
  x: 0,
  y: 0,
  scale: 1,
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('empty')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [rowBounds, setRowBounds] = useState<RowBounds | null>(null)
  const [settings, setSettings] = useState<TextSettings>(DEFAULT_SETTINGS)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS)
  const [imageTransform, setImageTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM)

  const { processMask, stage, foregroundRef, maskDimensionsRef } = useMask({ setRowBounds, setAppState })

  const handleImageUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setImageTransform(DEFAULT_TRANSFORM)
    setAppState('processing')
    processMask(url)
  }, [processMask])

  const handleNewImage = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
    setRowBounds(null)
    setImageTransform(DEFAULT_TRANSFORM)
    setAppState('empty')
  }, [imageUrl])

  return (
    <div className="app">
      {/* ─── Header ─── */}
      <header className="app-header" id="app-header">
        <div className="app-logo">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
            <path
              d="M8 22C8 16 12 10 16 10C20 10 24 16 24 22"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M11 20C11 16 13.5 12 16 12C18.5 12 21 16 21 20"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />
          </svg>
          <span className="app-logo-text">Contour</span>
        </div>
        {appState === 'ready' && (
          <div className="app-header-actions">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {canvasSize.width} × {canvasSize.height}
            </span>
          </div>
        )}
      </header>

      {/* ─── Empty State ─── */}
      {appState === 'empty' && <Dropzone onUpload={handleImageUpload} />}

      {/* ─── Processing State ─── */}
      {appState === 'processing' && (
        <div className="processing-screen" id="processing-screen">
          <div className="processing-orb">
            <div className="processing-orb-inner" />
            <div className="processing-orb-ring" />
          </div>
          <p className="processing-label">{stage.label || 'Preparing…'}</p>
          <div className="processing-bar-track">
            <div
              className="processing-bar-fill"
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Editor State ─── */}
      {(appState === 'ready' || appState === 'exporting') && imageUrl && rowBounds && (
        <div className="editor" id="editor">
          <ControlsPanel
            settings={settings}
            onSettingsChange={setSettings}
            canvasSize={canvasSize}
            onCanvasSizeChange={setCanvasSize}
            imageTransform={imageTransform}
            onImageTransformChange={setImageTransform}
            onNewImage={handleNewImage}
          />
          <CanvasPreview
            imageUrl={imageUrl}
            rowBounds={rowBounds}
            settings={settings}
            canvasSize={canvasSize}
            appState={appState}
            imageTransform={imageTransform}
            onImageTransformChange={setImageTransform}
            onExportStart={() => setAppState('exporting')}
            onExportEnd={() => setAppState('ready')}
            foregroundImage={foregroundRef.current}
            maskWidth={maskDimensionsRef.current.width}
            maskHeight={maskDimensionsRef.current.height}
          />
        </div>
      )}
    </div>
  )
}
