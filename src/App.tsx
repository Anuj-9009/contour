import { useState, useCallback, useRef } from 'react'
import { AppState, TextSettings, CanvasSize, RowBounds, ImageTransform, LyricLine, ProcessingStage } from './types'
import Dropzone from './components/Dropzone'
import ControlsPanel from './components/ControlsPanel'
import CanvasPreview from './components/CanvasPreview'
import { useMask } from './hooks/useMask'
import { useVideoMask } from './hooks/useVideoMask'

const DEFAULT_SETTINGS: TextSettings = {
  content: '',
  fontFamily: 'Inter',
  fontSize: 36,
  lineHeight: 48,
  color: '#ffffff',
  side: 'left',
  alignment: 'left',
  overlayOpacity: 0.15,
  enable3dEffect: true,
  textStartY: 120,
  padding: 40,

  // v2.0 Kinetic Azure Expansion Settings
  mode: 'photo',
  innerPadding: 20,
  subjectOffset: 0,
  stylePreset: 'classic',

  // Lyrics Sync & Audio Parameters
  lyricSource: 'lrc',
  lyricFontFamily: 'Outfit',
  lyricFontSize: 48,
  lyricColorActive: '#0f62fe',
  lyricColorInactive: '#ffffff',
  lyricInactiveOpacity: 0.4,
  lyricInactiveScale: 0.9,
  lyricGlowActive: true,

  // Export Settings
  exportResolution: '1080p',
  exportBitrate: 15,
  videoTextType: 'lyrics',

  // Matrix Character Juggle Canvas Mode Settings
  enableMatrixEffect: false,
  matrixCharSize: 16,
  matrixCharOpacity: 0.35,
  matrixCharColor: '#00ff00',
  textOpacity: 1.0,
}

const DEFAULT_CANVAS: CanvasSize = {
  format: '9:16', // Default to 9:16 Story format for v2.0 Kinetic Azure
  width: 1080,
  height: 1920,
}

const DEFAULT_TRANSFORM: ImageTransform = {
  x: 0,
  y: 0,
  scale: 1,
}

export default function App() {
  // App Core States
  const [appState, setAppState] = useState<AppState>('empty')
  const [settings, setSettings] = useState<TextSettings>(DEFAULT_SETTINGS)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS)
  const [imageTransform, setImageTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM)

  // Media Source States
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(0)
  const [enableGpu, setEnableGpu] = useState<boolean>(true)
  const [aiModel, setAiModel] = useState<'isnet_fp16' | 'isnet_quint8'>('isnet_fp16')
  const [originalMediaSize, setOriginalMediaSize] = useState<{ width: number; height: number } | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  // AI Segmentation States
  const [rowBounds, setRowBounds] = useState<RowBounds | null>(null)
  const [videoBounds, setVideoBounds] = useState<RowBounds[] | null>(null)
  const [videoRleMasks, setVideoRleMasks] = useState<Uint32Array[] | null>(null)
  const [stage, setStage] = useState<ProcessingStage>({ label: '', progress: 0 })

  // Playback & Timing Sync States
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([])
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Photo Segmentation Hook
  const { processMask, stage: photoStage, foregroundRef, maskDimensionsRef } = useMask({
    setRowBounds,
    setAppState: (s) => {
      if (s === 'ready') {
        setStage({ label: 'Analysis complete!', progress: 100 })
        setAppState('ready')
      } else if (s === 'empty') {
        setAppState('empty')
      }
    }
  })

  // Video Segmentation Hooks Callbacks
  const onVideoBoundsLoaded = useCallback((bounds: RowBounds[]) => {
    setVideoBounds(bounds)
  }, [])

  const onVideoFramesCached = useCallback((rleMasks: Uint32Array[]) => {
    setVideoRleMasks(rleMasks)
    setStage({ label: 'Video analyzed successfully!', progress: 100 })
    setAppState('ready')
  }, [])

  const { processVideoMasks, isProcessing: isVideoProcessing, stage: videoStage, cancelVideoProcessing } = useVideoMask({
    onVideoBoundsLoaded,
    onVideoFramesCached
  })

  // Handle uploaded media files
  const handleMediaUpload = useCallback(async (file: File, type: 'photo' | 'video' | 'audio') => {
    setAppState('processing')

    if (type === 'photo') {
      const url = URL.createObjectURL(file)
      setImageUrl(url)
      setVideoUrl(null)
      setVideoFile(null)
      setSettings(prev => ({ ...prev, mode: 'photo' }))
      setImageTransform(DEFAULT_TRANSFORM)
      
      const img = new Image()
      img.onload = () => {
        const width = img.naturalWidth || 1080
        const height = img.naturalHeight || 1080
        setOriginalMediaSize({ width, height })
        if (canvasSize.format === 'original') {
          setCanvasSize({ format: 'original', width, height })
        }
      }
      img.src = url

      // Run local image subject isolation
      setStage({ label: 'Initializing AI Models...', progress: 10 })
      processMask(url, enableGpu, aiModel)
    } else if (type === 'video') {
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setVideoFile(file)
      setImageUrl(null)
      setSettings(prev => ({ ...prev, mode: 'video' }))
      setImageTransform(DEFAULT_TRANSFORM)

      // Get video duration
      const tempVideo = document.createElement('video')
      tempVideo.src = url
      tempVideo.onloadedmetadata = () => {
        const dur = tempVideo.duration || 10
        const width = tempVideo.videoWidth || 1080
        const height = tempVideo.videoHeight || 1920
        setDuration(dur)
        setOriginalMediaSize({ width, height })
        if (canvasSize.format === 'original') {
          setCanvasSize({ format: 'original', width, height })
        }
        // Run local video segmenter (15 FPS downscaled RLE frames)
        processVideoMasks(url, dur, enableGpu, aiModel)

        // Clean up temp video element
        tempVideo.src = ''
        tempVideo.load()
      }
    } else if (type === 'audio') {
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      setAudioFile(file)
      setAppState('ready')
    }
  }, [processMask, processVideoMasks, enableGpu, canvasSize.format, aiModel])

  const handleNewMedia = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    if (audioUrl) URL.revokeObjectURL(audioUrl)

    setImageUrl(null)
    setVideoUrl(null)
    setVideoFile(null)
    setAudioUrl(null)
    setAudioFile(null)
    setOriginalMediaSize(null)
    setRowBounds(null)
    setVideoBounds(null)
    setVideoRleMasks(null)
    setImageTransform(DEFAULT_TRANSFORM)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setLyricLines([])
    setAppState('empty')
  }, [imageUrl, videoUrl, audioUrl])

  // Track processing progress labels
  const currentStageLabel = settings.mode === 'video' ? videoStage.label : photoStage.label
  const currentStageProgress = settings.mode === 'video' ? videoStage.progress : photoStage.progress

  return (
    <div className="app bg-[#f9f9f9] text-[#1a1c1c] dark:bg-slate-950 dark:text-white transition-colors duration-300 min-h-screen flex flex-col">
      {/* ─── Header ─── */}
      <header className="app-header flex items-center justify-between px-6 h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 transition-colors" id="app-header">
        <div className="app-logo flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-white shadow-sm border border-blue-500/20">
            <span className="material-symbols-outlined text-xl">blur_circular</span>
          </div>
          <span className="app-logo-text font-headline font-bold text-xl tracking-tight text-slate-800 dark:text-white">
            Contour <span className="text-primary-container text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 ml-1.5 align-middle border border-blue-500/20">v2.0</span>
          </span>
        </div>
        {appState === 'ready' && (
          <div className="app-header-actions flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 px-3 py-1 rounded-full font-label">
              {settings.mode.toUpperCase()} WORKSPACE • {canvasSize.width} × {canvasSize.height}
            </span>
          </div>
        )}
      </header>

      {/* ─── Empty State ─── */}
      {appState === 'empty' && (
        <Dropzone
          onUpload={handleMediaUpload}
          enableGpu={enableGpu}
          onToggleGpu={setEnableGpu}
          aiModel={aiModel}
          onChangeAiModel={setAiModel}
        />
      )}

      {/* ─── Processing State ─── */}
      {appState === 'processing' && (
        <div className="processing-screen flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950" id="processing-screen">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-2xl p-10 max-w-sm w-full mx-auto flex flex-col items-center justify-center text-center">
            {/* Beautiful pulsing, spinning loader orb */}
            <div className="processing-orb mb-8 flex items-center justify-center">
              <div className="processing-orb-inner" />
              <div className="processing-orb-ring" />
              <div className="absolute inset-0 flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-3xl animate-pulse">psychology</span>
              </div>
            </div>
            
            <h3 className="text-2xl font-headline font-extrabold text-slate-800 dark:text-slate-100 mb-2">
              Processing Subject Masks
            </h3>
            <p className="text-sm font-body text-slate-500 dark:text-slate-400 mb-6 max-w-xs h-10 flex items-center justify-center">
              {currentStageLabel || 'Preparing local AI segmentation…'}
            </p>

            <div className="w-full flex flex-col gap-2 items-center mb-6">
              <div className="processing-bar-track w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="processing-bar-fill h-full bg-primary-container rounded-full transition-all duration-300"
                  style={{ width: `${currentStageProgress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-400 font-label">
                {currentStageProgress}% Complete
              </span>
            </div>

            {settings.mode === 'video' && (
              <button
                onClick={cancelVideoProcessing}
                className="mt-2 px-6 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 transition-all shadow-sm"
              >
                Cancel Processing
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Editor State ─── */}
      {(appState === 'ready' || appState === 'exporting') && (
        <div className="editor flex-1 grid grid-cols-1 md:grid-cols-[380px_1fr] gap-0 min-h-0 bg-slate-50 dark:bg-slate-950" id="editor">
          <ControlsPanel
            settings={settings}
            onSettingsChange={setSettings}
            canvasSize={canvasSize}
            onCanvasSizeChange={setCanvasSize}
            imageTransform={imageTransform}
            onImageTransformChange={setImageTransform}
            onNewImage={handleNewMedia}
            lyricLines={lyricLines}
            onLyricLinesChange={setLyricLines}
            videoFile={videoFile}
            audioUrl={audioUrl || videoUrl}
            audioFile={audioFile}
            originalMediaSize={originalMediaSize}
            onAudioUpload={(file) => {
              if (audioUrl) URL.revokeObjectURL(audioUrl)
              const url = URL.createObjectURL(file)
              setAudioUrl(url)
              setAudioFile(file)
            }}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onPlayToggle={setIsPlaying}
          />
          <CanvasPreview
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            rowBounds={rowBounds}
            videoBounds={videoBounds}
            videoRleMasks={videoRleMasks}
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
            lyricLines={lyricLines}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            isPlaying={isPlaying}
            onPlayToggle={setIsPlaying}
            duration={duration}
            videoFile={videoFile}
          />
        </div>
      )}
    </div>
  )
}
