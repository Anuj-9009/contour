export type AppState = 'empty' | 'processing' | 'ready' | 'exporting'

export type ExportFormat = '1:1' | '4:5' | '9:16' | 'original'

export type TextSide = 'left' | 'right' | 'both'

export type TextAlignment = 'left' | 'center' | 'right'

export type EditorMode = 'photo' | 'video'

export type LyricSource = 'lrc' | 'tapper' | 'ai'

export type ExportResolution = '1080p' | '4k' | 'print'

export type StylePreset = 'classic' | 'neon' | 'outline' | 'gradient'

export interface LyricLine {
  text: string
  timestamp: number // millisecond timestamp
}

export interface TextSettings {
  content: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  color: string
  side: TextSide
  alignment: TextAlignment
  overlayOpacity: number
  enable3dEffect: boolean
  textStartY: number
  padding: number

  // v2.0 Kinetic Azure Expansion Settings
  mode: EditorMode
  innerPadding: number    // Padding around the subject edge
  subjectOffset: number   // Horizontal boundary offset shifting
  stylePreset: StylePreset

  // Lyrics Sync & Audio Parameters
  lyricSource: LyricSource
  lyricFontFamily: string
  lyricFontSize: number
  lyricColorActive: string
  lyricColorInactive: string
  lyricInactiveOpacity: number
  lyricInactiveScale: number
  lyricGlowActive: boolean

  // Export Settings
  exportResolution: ExportResolution
  exportBitrate: number // in Mbps
  videoTextType?: 'lyrics' | 'custom'

  // Matrix Character Juggle Canvas Mode Settings
  enableMatrixEffect?: boolean
  matrixCharSize?: number
  matrixCharOpacity?: number
  matrixCharColor?: string
  textOpacity?: number
}

export interface CanvasSize {
  format: ExportFormat
  width: number
  height: number
}

export interface RowBounds {
  left: number[]
  right: number[]
}

export interface ImageTransform {
  x: number
  y: number
  scale: number
}

export interface ProcessingStage {
  label: string
  progress: number
}

export const CANVAS_PRESETS: Record<ExportFormat, { width: number; height: number; label: string }> = {
  '1:1': { width: 1080, height: 1080, label: 'Square 1:1' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait 4:5' },
  '9:16': { width: 1080, height: 1920, label: 'Story 9:16' },
  'original': { width: 1080, height: 1080, label: 'Original' },
}

export const FONT_OPTIONS = [
  'Inter',
  'Playfair Display',
  'Georgia',
  'Montserrat',
  'Syne',
  'Outfit',
  'Lora',
  'Oswald',
]
