export type AppState = 'empty' | 'processing' | 'ready' | 'exporting'

export type ExportFormat = '1:1' | '4:5' | '9:16'

export type TextSide = 'left' | 'right' | 'both'

export type TextAlignment = 'left' | 'center' | 'right'

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
