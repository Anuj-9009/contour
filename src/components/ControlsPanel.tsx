import { useState, useRef, useEffect } from 'react'
import { TextSettings, CanvasSize, ExportFormat, TextSide, TextAlignment, CANVAS_PRESETS, FONT_OPTIONS, ImageTransform, LyricLine, LyricSource, StylePreset } from '../types'
import { useTranscriber } from '../hooks/useTranscriber'

interface Props {
  settings: TextSettings
  onSettingsChange: (s: TextSettings) => void
  canvasSize: CanvasSize
  onCanvasSizeChange: (s: CanvasSize) => void
  imageTransform: ImageTransform
  onImageTransformChange: (t: ImageTransform) => void
  onNewImage: () => void
  lyricLines: LyricLine[]
  onLyricLinesChange: (lines: LyricLine[]) => void
  videoFile: File | null
  audioUrl: string | null
  audioFile: File | null
  originalMediaSize: { width: number; height: number } | null
  onAudioUpload: (file: File) => void
  currentTime: number
  isPlaying: boolean
  onPlayToggle: (playing: boolean) => void
}

const COLOR_PRESETS = [
  '#ffffff',
  '#0f62fe', // Active Cobalt Azure Blue
  '#fbbf24',
  '#f87171',
  '#34d399',
  '#60a5fa',
  '#a78bfa',
  '#fb923c',
  '#000000',
]

export default function ControlsPanel({
  settings,
  onSettingsChange,
  canvasSize,
  onCanvasSizeChange,
  imageTransform,
  onImageTransformChange,
  onNewImage,
  lyricLines,
  onLyricLinesChange,
  videoFile,
  audioUrl,
  audioFile,
  originalMediaSize,
  onAudioUpload,
  currentTime,
  isPlaying,
  onPlayToggle,
}: Props) {
  const [activeTab, setActiveTab] = useState<'layout' | 'typography' | 'lyrics' | 'matrix'>('layout')
  const [plainTextLyrics, setPlainTextLyrics] = useState('')
  const [currentSyncingIdx, setCurrentSyncingIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const { transcribeAudio, isTranscribing, transcribeProgress, error: transcribeError } = useTranscriber()

  function updateSetting<K extends keyof TextSettings>(key: K, value: TextSettings[K]) {
    onSettingsChange({ ...settings, [key]: value })
  }

  function updateTransform<K extends keyof ImageTransform>(key: K, value: ImageTransform[K]) {
    onImageTransformChange({ ...imageTransform, [key]: value })
  }

  function handleFormatChange(format: ExportFormat) {
    if (format === 'original') {
      if (originalMediaSize) {
        onCanvasSizeChange({ format, width: originalMediaSize.width, height: originalMediaSize.height })
      } else {
        onCanvasSizeChange({ format, width: 1080, height: 1920 })
      }
    } else {
      const preset = CANVAS_PRESETS[format]
      onCanvasSizeChange({ format, width: preset.width, height: preset.height })
    }
  }

  // Parse LRC timing strings with robust multiline and formatting tolerance
  const parseLRC = (text: string) => {
    // Strip UTF-8 Byte Order Mark (BOM) if present
    const cleanText = text.replace(/^\uFEFF/, '')
    const lines = cleanText.split(/\r?\n/)
    const parsed: LyricLine[] = []
    
    // Bulletproof regex supporting standard and padded times [mm:ss], [mm:ss.xx], [mm:ss.xxx], and spaces
    const timestampRegex = /\[\s*(\d+)\s*:\s*(\d+)\s*(?:[.,:]\s*(\d+))?\s*\]/g

    for (const line of lines) {
      if (!line.trim()) continue

      const timestamps: number[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      timestampRegex.lastIndex = 0
      while ((match = timestampRegex.exec(line)) !== null) {
        const min = parseInt(match[1], 10)
        const sec = parseInt(match[2], 10)
        const fracStr = match[3] || '0'
        
        let ms = 0
        if (fracStr) {
          const paddedFrac = fracStr.padEnd(3, '0').slice(0, 3)
          ms = parseInt(paddedFrac, 10)
        }
        
        const timestampMs = min * 60 * 1000 + sec * 1000 + ms
        timestamps.push(timestampMs)
        lastIndex = timestampRegex.lastIndex
      }

      const textStr = line.slice(lastIndex).trim()
      
      // If timestamps were found, we push the line.
      // We allow textStr to be empty ("") so that empty timestamps can act as active lyric clearers during instrumental breaks!
      if (timestamps.length > 0) {
        for (const ts of timestamps) {
          parsed.push({
            text: textStr || '',
            timestamp: ts
          })
        }
      }
    }

    if (parsed.length > 0) {
      const sorted = parsed.sort((a, b) => a.timestamp - b.timestamp)
      console.log(`[LRC Ingest] Successfully parsed ${sorted.length} lyric lines:`, sorted)
      onLyricLinesChange(sorted)
    } else {
      console.warn('[LRC Ingest] Warning: No timed lyrics parsed. File contents:', cleanText)
    }
  }

  const handleLrcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      parseLRC(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Tactile Sync Tapper Initialize
  const handlePlainTextInit = () => {
    const rows = plainTextLyrics.split('\n').map(r => r.trim()).filter(Boolean)
    if (rows.length === 0) return
    const initLines = rows.map(r => ({ text: r, timestamp: -1 }))
    onLyricLinesChange(initLines)
    setCurrentSyncingIdx(0)
  }

  // Stamp current millisecond playback time on the next unsynced row
  const handleTapSync = () => {
    const nextUnsyncedIdx = lyricLines.findIndex(l => l.timestamp === -1)
    if (nextUnsyncedIdx !== -1) {
      const updated = [...lyricLines]
      updated[nextUnsyncedIdx] = {
        ...updated[nextUnsyncedIdx],
        timestamp: Math.round(currentTime * 1000)
      }
      onLyricLinesChange(updated)
      setCurrentSyncingIdx(nextUnsyncedIdx + 1)
    }
  }

  // Reset timing stamps in tapper mode
  const handleResetSync = () => {
    const resetLines = lyricLines.map(l => ({ ...l, timestamp: -1 }))
    onLyricLinesChange(resetLines)
    setCurrentSyncingIdx(0)
  }

  // Run AI Speech-to-Text Transcribing
  const handleAiTranscribe = async () => {
    const fileToTranscribe = audioFile || videoFile
    if (!fileToTranscribe) return
    try {
      const lyrics = await transcribeAudio(fileToTranscribe)
      onLyricLinesChange(lyrics)
    } catch (err) {
      console.error('Whisper execution error:', err)
    }
  }

  // Keydown listener for Spacebar beat tapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settings.mode === 'video' && settings.lyricSource === 'tapper' && e.code === 'Space' && isPlaying) {
        // Prevent default space page scroll
        e.preventDefault()
        handleTapSync()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lyricLines, currentTime, isPlaying, settings.mode, settings.lyricSource])

  return (
    <aside className="controls-panel w-[380px] border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col h-[calc(100vh-64px)] overflow-hidden shadow-sm" id="controls-panel">
      {/* ─── Mode Selector Tab Toggles ─── */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200/50 dark:border-slate-700/50">
          <button
            className={`flex-1 py-2 text-xs font-headline font-bold rounded-full transition-all ${
              settings.mode === 'photo'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            onClick={() => {
              updateSetting('mode', 'photo')
              if (activeTab === 'lyrics') setActiveTab('layout')
            }}
          >
            Photo Workspace
          </button>
          <button
            className={`flex-1 py-2 text-xs font-headline font-bold rounded-full transition-all ${
              settings.mode === 'video'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            onClick={() => updateSetting('mode', 'video')}
          >
            Video Workspace
          </button>
        </div>

        {/* Local Tab Selection */}
        <div className="flex gap-2 text-xs border-b border-slate-100 dark:border-slate-800 pb-1 mt-2">
          <button
            onClick={() => setActiveTab('layout')}
            className={`pb-2 px-1 font-semibold border-b-2 transition-all ${
              activeTab === 'layout'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Layout
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className={`pb-2 px-1 font-semibold border-b-2 transition-all ${
              activeTab === 'typography'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Typography
          </button>
          {settings.mode === 'video' && (
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`pb-2 px-1 font-semibold border-b-2 transition-all ${
                activeTab === 'lyrics'
                  ? 'border-primary-container text-primary-container'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              Lyrics Sync
            </button>
          )}
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-2 px-1 font-semibold border-b-2 transition-all ${
              activeTab === 'matrix'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Matrix Effect
          </button>
        </div>
      </div>

      {/* ─── Scrollable Parameter Controls ─── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        
        {/* ─── TAB 1: LAYOUT SETTINGS ─── */}
        {activeTab === 'layout' && (
          <>
            {/* Format Format Selection */}
            <div className="control-group">
              <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Canvas Format</label>
              <div className="grid grid-cols-4 gap-2" id="format-selector">
                {(['1:1', '4:5', '9:16', 'original'] as ExportFormat[]).map((fmt) => {
                  const label = fmt === 'original' ? 'Original' : CANVAS_PRESETS[fmt].label.replace('Square ', '').replace('Portrait ', '').replace('Story ', '')
                  return (
                    <button
                      key={fmt}
                      className={`py-2 text-[10px] font-semibold rounded-full border transition-all ${
                        canvasSize.format === fmt
                          ? 'border-primary-container bg-primary-lighter/10 text-primary-container shadow-sm font-bold'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-950 text-slate-500'
                      }`}
                      onClick={() => handleFormatChange(fmt)}
                      id={`format-${fmt.replace(':', '-')}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Video Text Type Switcher */}
            {settings.mode === 'video' && (
              <div className="control-group">
                <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Video Text Mode</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200/50 dark:border-slate-700/50">
                  <button
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all ${
                      settings.videoTextType !== 'custom'
                        ? 'bg-primary-container text-white shadow-sm font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                    onClick={() => updateSetting('videoTextType', 'lyrics')}
                  >
                    Lyrics Sync
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all ${
                      settings.videoTextType === 'custom'
                        ? 'bg-primary-container text-white shadow-sm font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                    onClick={() => updateSetting('videoTextType', 'custom')}
                  >
                    Custom Text
                  </button>
                </div>
              </div>
            )}

            {/* Static Content / Video Overlay Title */}
            {(settings.mode === 'photo' || (settings.mode === 'video' && settings.videoTextType === 'custom')) && (
              <div className="control-group">
                <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Display Text</label>
                <textarea
                  className="control-textarea w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
                  rows={4}
                  value={settings.content}
                  onChange={(e) => updateSetting('content', e.target.value)}
                  placeholder="Enter your cover copy copy here…"
                  id="text-input"
                />
              </div>
            )}

            {/* Subject Wrapping Parameters */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">AI Subject Alignment</h3>
              
              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Inner Padding (Subject Margin)</span>
                  <span className="text-primary-container">{settings.innerPadding}px</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={0}
                  max={80}
                  value={settings.innerPadding}
                  onChange={(e) => updateSetting('innerPadding', Number(e.target.value))}
                  id="inner-padding-slider"
                />
              </div>

              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Subject Offset (Shift Boundary)</span>
                  <span className="text-primary-container">{settings.subjectOffset}px</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={-120}
                  max={120}
                  value={settings.subjectOffset}
                  onChange={(e) => updateSetting('subjectOffset', Number(e.target.value))}
                  id="subject-offset-slider"
                />
              </div>
            </div>

            {/* Text Positioning & alignment parameters */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Text Start Y Position</span>
                  <span className="text-primary-container">{settings.textStartY}px</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={20}
                  max={canvasSize.height - 100}
                  value={settings.textStartY}
                  onChange={(e) => updateSetting('textStartY', Number(e.target.value))}
                  id="text-start-slider"
                />
              </div>

              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Text Outer Padding</span>
                  <span className="text-primary-container">{settings.padding}px</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={0}
                  max={100}
                  value={settings.padding}
                  onChange={(e) => updateSetting('padding', Number(e.target.value))}
                  id="padding-slider"
                />
              </div>
            </div>

            {/* Text wrap settings */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="control-group">
                <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Alignment Side</label>
                <div className="grid grid-cols-3 gap-2" id="side-selector">
                  {(['left', 'right', 'both'] as TextSide[]).map((s) => (
                    <button
                      key={s}
                      className={`py-1.5 text-xs font-semibold rounded-full border transition-all ${
                        settings.side === s
                          ? 'border-primary-container bg-primary-lighter/10 text-primary-container font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500'
                      }`}
                      onClick={() => updateSetting('side', s)}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Text Align</label>
                <div className="grid grid-cols-3 gap-2" id="align-selector">
                  {(['left', 'center', 'right'] as TextAlignment[]).map((a) => (
                    <button
                      key={a}
                      className={`py-1.5 text-xs font-semibold rounded-full border transition-all ${
                        settings.alignment === a
                          ? 'border-primary-container bg-primary-lighter/10 text-primary-container font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500'
                      }`}
                      onClick={() => updateSetting('alignment', a)}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3D Depth Layer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">3D Subject Depth Overlay</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Places text behind subject silhouette contours.</p>
                </div>
                <div
                  className={`w-11 h-6 rounded-full cursor-pointer p-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container ${
                    settings.enable3dEffect ? 'bg-primary-container' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                  onClick={() => updateSetting('enable3dEffect', !settings.enable3dEffect)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      updateSetting('enable3dEffect', !settings.enable3dEffect)
                    }
                  }}
                  tabIndex={0}
                  role="switch"
                  aria-checked={settings.enable3dEffect}
                  id="3d-toggle"
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.enable3dEffect ? 'translate-x-5' : ''}`} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── TAB 2: TYPOGRAPHY CUSTOMIZATION ─── */}
        {activeTab === 'typography' && (
          <>
            <div className="control-group">
              <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Font Family</label>
              <select
                className="w-full text-sm p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                value={settings.mode === 'video' ? settings.lyricFontFamily : settings.fontFamily}
                onChange={(e) => updateSetting(settings.mode === 'video' ? 'lyricFontFamily' : 'fontFamily', e.target.value)}
                id="font-selector"
                style={{ fontFamily: settings.mode === 'video' ? settings.lyricFontFamily : settings.fontFamily }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Font Size</span>
                <span className="text-primary-container">
                  {settings.mode === 'video' ? settings.lyricFontSize : settings.fontSize}px
                </span>
              </div>
              <input
                type="range"
                className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                min={16}
                max={96}
                value={settings.mode === 'video' ? settings.lyricFontSize : settings.fontSize}
                onChange={(e) => updateSetting(settings.mode === 'video' ? 'lyricFontSize' : 'fontSize', Number(e.target.value))}
                id="font-size-slider"
              />
            </div>

            {settings.mode === 'photo' && (
              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Line Height</span>
                  <span className="text-primary-container">{settings.lineHeight}px</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={20}
                  max={140}
                  value={settings.lineHeight}
                  onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
                  id="line-height-slider"
                />
              </div>
            )}

            {/* Presets / Colors section */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block">Typography Colors</label>
              
              <div className="control-group">
                <span className="text-xs text-slate-400 mb-2 block">
                  {settings.mode === 'video' ? 'Active Line Lyric Color' : 'Text Solid Fill Color'}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0 relative">
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={settings.mode === 'video' ? settings.lyricColorActive : settings.color}
                      onChange={(e) => updateSetting(settings.mode === 'video' ? 'lyricColorActive' : 'color', e.target.value)}
                      id="color-picker"
                    />
                    <div className="w-full h-full" style={{ backgroundColor: settings.mode === 'video' ? settings.lyricColorActive : settings.color }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        className={`w-7 h-7 rounded-full border border-slate-100 dark:border-slate-800/80 transition-all ${
                          (settings.mode === 'video' ? settings.lyricColorActive : settings.color) === c
                            ? 'scale-110 ring-2 ring-primary-container shadow-sm'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => updateSetting(settings.mode === 'video' ? 'lyricColorActive' : 'color', c)}
                        aria-label={`Set color to ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {settings.mode === 'video' && (
                <div className="control-group pt-2">
                  <span className="text-xs text-slate-400 mb-2 block">Inactive / Past Lines Lyric Color</span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0 relative">
                      <input
                        type="color"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={settings.lyricColorInactive.startsWith('rgba') ? '#ffffff' : settings.lyricColorInactive}
                        onChange={(e) => updateSetting('lyricColorInactive', e.target.value)}
                      />
                      <div className="w-full h-full" style={{ backgroundColor: settings.lyricColorInactive.startsWith('rgba') ? 'rgba(255,255,255,0.4)' : settings.lyricColorInactive }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          className={`w-7 h-7 rounded-full border border-slate-100 dark:border-slate-800/80 transition-all ${
                            settings.lyricColorInactive === c ? 'scale-110 ring-2 ring-primary-container shadow-sm' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => updateSetting('lyricColorInactive', c)}
                          aria-label={`Set inactive color to ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Typography Presets */}
            {settings.mode === 'photo' ? (
              <div className="control-group pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Style Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['classic', 'neon', 'outline'] as StylePreset[]).map((pr) => (
                    <button
                      key={pr}
                      className={`py-1.5 text-xs font-semibold rounded-full border transition-all ${
                        settings.stylePreset === pr
                          ? 'border-primary-container bg-primary-lighter/10 text-primary-container font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500'
                      }`}
                      onClick={() => updateSetting('stylePreset', pr)}
                    >
                      {pr.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Video typography additional controls
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-slate-400">Kinetic Lyric Layers</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Active Lyric Electric Glow</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Adds vibrant neon azure shadow glow to the active vocal line.</p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full cursor-pointer p-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container ${
                      settings.lyricGlowActive ? 'bg-primary-container' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                    onClick={() => updateSetting('lyricGlowActive', !settings.lyricGlowActive)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        updateSetting('lyricGlowActive', !settings.lyricGlowActive)
                      }
                    }}
                    tabIndex={0}
                    role="switch"
                    aria-checked={settings.lyricGlowActive}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.lyricGlowActive ? 'translate-x-5' : ''}`} />
                  </div>
                </div>

                <div className="control-group pt-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>Inactive Lyric Scale Out</span>
                    <span className="text-primary-container">{(settings.lyricInactiveScale * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    min={0.5}
                    max={1}
                    step={0.05}
                    value={settings.lyricInactiveScale}
                    onChange={(e) => updateSetting('lyricInactiveScale', Number(e.target.value))}
                  />
                </div>

                <div className="control-group">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>Inactive Lyric Opacity Fade</span>
                    <span className="text-primary-container">{(settings.lyricInactiveOpacity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={settings.lyricInactiveOpacity}
                    onChange={(e) => updateSetting('lyricInactiveOpacity', Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Background Dim */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Background Overlay Darken</span>
                  <span className="text-primary-container">{(settings.overlayOpacity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={settings.overlayOpacity}
                  onChange={(e) => updateSetting('overlayOpacity', Number(e.target.value))}
                  id="overlay-slider"
                />
              </div>

              <div className="control-group">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Background Image Scale</span>
                  <span className="text-primary-container">{(imageTransform.scale * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={imageTransform.scale}
                  onChange={(e) => updateTransform('scale', Number(e.target.value))}
                  id="image-scale-slider"
                />
              </div>
            </div>
          </>
        )}

        {/* ─── TAB 3: LYRICS SYNCS CONSOLE (VIDEO ONLY) ─── */}
        {activeTab === 'lyrics' && settings.mode === 'video' && (
          <div className="space-y-6">
            
            {/* Sync Mode Selector */}
            <div className="control-group">
              <label className="control-label font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">Lyric Syncing Pathway</label>
              <div className="grid grid-cols-3 gap-2">
                {(['lrc', 'tapper', 'ai'] as LyricSource[]).map((src) => (
                  <button
                    key={src}
                    className={`py-1.5 text-[10px] font-bold rounded-full border transition-all ${
                      settings.lyricSource === src
                        ? 'border-primary-container bg-primary-lighter/10 text-primary-container shadow-sm font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500'
                    }`}
                    onClick={() => updateSetting('lyricSource', src)}
                  >
                    {src === 'lrc' ? 'DIRECT LRC' : src === 'tapper' ? 'SYNC TAPPER' : 'OFFLINE AI'}
                  </button>
                ))}
              </div>
            </div>

            {/* LRC FILE UPLOADER (Option B1) */}
            {settings.lyricSource === 'lrc' && (
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 text-center">
                <span className="material-symbols-outlined text-3xl text-primary-container mb-2 block">description</span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Direct Timed LRC Ingestion</h4>
                <p className="text-xs text-slate-400 mb-4">Upload a standard synchronized `.lrc` lyrics file.</p>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary rounded-full text-xs font-bold px-4 py-2 bg-primary-container text-white"
                >
                  Choose LRC File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".lrc,.txt,text/plain"
                  onChange={handleLrcUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* TACTILE BEAT SYNC TAPPER (Option B2) */}
            {settings.lyricSource === 'tapper' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Step 1: Paste Raw Plain Lyrics</h4>
                  <textarea
                    rows={4}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                    value={plainTextLyrics}
                    onChange={(e) => setPlainTextLyrics(e.target.value)}
                    placeholder="Enter lyric lines...&#10;One sentence per row.&#10;Example:&#10;Yeah, we're building Contour&#10;Offline AI typography"
                  />
                  <button
                    onClick={handlePlainTextInit}
                    disabled={!plainTextLyrics.trim()}
                    className="w-full mt-2.5 btn-secondary text-xs rounded-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold"
                  >
                    Prepare Sync Playlist
                  </button>
                </div>

                {lyricLines.length > 0 && lyricLines[0].timestamp === -1 && (
                  <div className="p-4 rounded-lg border border-primary-container/20 bg-primary-lighter/5 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-3xl text-primary-container mb-2 animate-bounce">keyboard</span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Step 2: Sync Beat Tapping</h4>
                    <p className="text-xs text-slate-400 max-w-xs mb-4 leading-normal">
                      Press Play on the video. Click this big button (or hit **Spacebar**) exactly when the highlighted lyric line is sung!
                    </p>

                    <button
                      onClick={handleTapSync}
                      disabled={!isPlaying}
                      className={`w-full py-4 text-sm rounded-lg font-headline font-bold flex flex-col items-center justify-center transition-all ${
                        isPlaying
                          ? 'bg-primary-container hover:bg-[#0056D2] text-white shadow-lg scale-98 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-[10px] opacity-75 mb-0.5">TAP BEAT OR SPACEBAR</span>
                      <span>TAP TO STAMP TIMING</span>
                    </button>

                    <div className="w-full mt-4 space-y-1.5 text-left max-h-[140px] overflow-y-auto border border-slate-100 dark:border-slate-800 p-2 rounded-lg bg-white dark:bg-slate-950">
                      {lyricLines.map((line, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] border-b border-slate-50 dark:border-slate-900 pb-1 last:border-b-0">
                          <span className={`truncate max-w-[170px] ${idx === currentSyncingIdx && isPlaying ? 'text-primary-container font-extrabold' : 'text-slate-500'}`}>
                            {idx + 1}. {line.text}
                          </span>
                          <span className={`font-semibold ${line.timestamp !== -1 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {line.timestamp !== -1 ? `${(line.timestamp / 1000).toFixed(2)}s` : 'UNSYNCED'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleResetSync}
                      className="text-xs text-rose-500 hover:text-rose-600 font-bold mt-3"
                    >
                      Reset Synchronization Timestamps
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* OFFLINE AI VOICE TRANSCRIPTION (Option B3) */}
            {settings.lyricSource === 'ai' && (
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 text-center space-y-4">
                <div>
                  <span className="material-symbols-outlined text-3xl text-primary-container mb-2 block animate-pulse">auto_awesome</span>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Local Whisper Speech ASR</h4>
                  <p className="text-xs text-slate-400 max-w-xs leading-normal mx-auto">
                    Our embedded voice-to-text pipeline runs **Whisper-Tiny WASM** locally to automatically align timings!
                  </p>
                </div>

                {/* Optional Audio File Ingestion */}
                <div className="p-3 border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 rounded-lg flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Ingest Independent Audio (MP3/WAV)</span>
                  {audioFile ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                      <span className="material-symbols-outlined text-sm">audiotrack</span>
                      <span className="truncate max-w-[200px]">{audioFile.name}</span>
                      <button
                        onClick={() => {
                          if (audioFileInputRef.current) audioFileInputRef.current.value = ''
                        }}
                        className="text-rose-500 hover:text-rose-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => audioFileInputRef.current?.click()}
                      className="btn-secondary rounded-full text-[10px] font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">upload</span>
                      Upload Audio File
                    </button>
                  )}
                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        onAudioUpload(file)
                      }
                    }}
                    className="hidden"
                  />
                </div>

                {isTranscribing ? (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      AI Transcribing Vocals... {transcribeProgress}%
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-container rounded-full transition-all duration-300 animate-pulse"
                        style={{ width: `${transcribeProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={handleAiTranscribe}
                      disabled={!videoFile && !audioFile}
                      className={`btn-primary rounded-full text-xs font-bold px-6 py-2.5 flex items-center justify-center gap-1.5 mx-auto ${
                        (videoFile || audioFile) ? 'bg-primary-container hover:bg-[#0056D2] text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border-none'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      AI Transcribe Vocals 🪄
                    </button>
                    {!videoFile && !audioFile && (
                      <p className="text-[10px] text-amber-500 font-semibold mt-2.5">
                        Please ingest a Video or Audio File to activate offline AI transcription.
                      </p>
                    )}
                  </div>
                )}

                {transcribeError && (
                  <div className="text-xs text-rose-500 font-semibold mt-3 p-2 bg-rose-50 rounded border border-rose-100">
                    {transcribeError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: MATRIX BACKGROUND CONSOLE ─── */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            
            {/* Enable Matrix Effect switch */}
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Matrix Backdrop Canvas Mode</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Render a dense random character grid behind subject and text boundaries.</p>
                </div>
                <div
                  className={`w-11 h-6 rounded-full cursor-pointer p-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container ${
                    settings.enableMatrixEffect ? 'bg-primary-container' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                  onClick={() => updateSetting('enableMatrixEffect', !settings.enableMatrixEffect)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      updateSetting('enableMatrixEffect', !settings.enableMatrixEffect)
                    }
                  }}
                  tabIndex={0}
                  role="switch"
                  aria-checked={settings.enableMatrixEffect}
                  id="matrix-toggle"
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.enableMatrixEffect ? 'translate-x-5' : ''}`} />
                </div>
              </div>
            </div>

            {settings.enableMatrixEffect && (
              <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800 transition-all">
                
                {/* Character Size */}
                <div className="control-group">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>Matrix Character Size</span>
                    <span className="text-primary-container">{settings.matrixCharSize || 16}px</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    min={8}
                    max={32}
                    step={1}
                    value={settings.matrixCharSize || 16}
                    onChange={(e) => updateSetting('matrixCharSize', Number(e.target.value))}
                    id="matrix-size-slider"
                  />
                </div>

                {/* Character Opacity */}
                <div className="control-group">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>Character Grid Opacity</span>
                    <span className="text-primary-container">{Math.round((settings.matrixCharOpacity ?? 0.35) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    min={0.05}
                    max={1.00}
                    step={0.05}
                    value={settings.matrixCharOpacity ?? 0.35}
                    onChange={(e) => updateSetting('matrixCharOpacity', Number(e.target.value))}
                    id="matrix-opacity-slider"
                  />
                </div>

                {/* Text Layer Opacity */}
                <div className="control-group">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>Text Layer Opacity</span>
                    <span className="text-primary-container">{Math.round((settings.textOpacity ?? 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary-container h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    min={0.00}
                    max={1.00}
                    step={0.05}
                    value={settings.textOpacity ?? 1.0}
                    onChange={(e) => updateSetting('textOpacity', Number(e.target.value))}
                    id="text-opacity-slider"
                  />
                </div>

                {/* Matrix Colors */}
                <div className="space-y-3 pt-2">
                  <label className="font-headline font-bold text-xs uppercase tracking-wider text-slate-400 block">Matrix Character Colors</label>
                  <div className="control-group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0 relative">
                        <input
                          type="color"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          value={settings.matrixCharColor || '#00ff00'}
                          onChange={(e) => updateSetting('matrixCharColor', e.target.value)}
                          id="matrix-color-picker"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: settings.matrixCharColor || '#00ff00' }} />
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                        {['#00ff00', '#00ffff', '#ffffff', '#ff007f'].map((c) => (
                          <button
                            key={c}
                            className={`w-7 h-7 rounded-full border border-slate-100 dark:border-slate-800/80 transition-all ${
                              (settings.matrixCharColor || '#00ff00') === c
                                ? 'scale-110 ring-2 ring-primary-container shadow-sm'
                                : 'hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                            onClick={() => updateSetting('matrixCharColor', c)}
                            aria-label={`Set matrix color to ${c}`}
                          />
                        ))}
                        
                        <div className="ml-2 flex-1">
                          <input
                            type="text"
                            className="w-full text-xs font-semibold px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-container text-slate-700 dark:text-slate-300 font-mono"
                            placeholder="#00ff00"
                            value={settings.matrixCharColor || '#00ff00'}
                            onChange={(e) => updateSetting('matrixCharColor', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Sidebar Footer Actions ─── */}
      <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-3">
        <button
          className="btn-secondary rounded-full flex-1 py-2 text-xs font-headline font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
          onClick={onNewImage}
          id="new-image-btn"
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
          Reset Studio
        </button>
      </div>
    </aside>
  )
}
