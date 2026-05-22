import { TextSettings, CanvasSize, ExportFormat, TextSide, TextAlignment, CANVAS_PRESETS, FONT_OPTIONS, ImageTransform } from '../types'

interface Props {
  settings: TextSettings
  onSettingsChange: (s: TextSettings) => void
  canvasSize: CanvasSize
  onCanvasSizeChange: (s: CanvasSize) => void
  imageTransform: ImageTransform
  onImageTransformChange: (t: ImageTransform) => void
  onNewImage: () => void
}

const COLOR_PRESETS = [
  '#ffffff',
  '#f0eef6',
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
}: Props) {
  function updateSetting<K extends keyof TextSettings>(key: K, value: TextSettings[K]) {
    onSettingsChange({ ...settings, [key]: value })
  }

  function updateTransform<K extends keyof ImageTransform>(key: K, value: ImageTransform[K]) {
    onImageTransformChange({ ...imageTransform, [key]: value })
  }

  function handleFormatChange(format: ExportFormat) {
    const preset = CANVAS_PRESETS[format]
    onCanvasSizeChange({ format, width: preset.width, height: preset.height })
  }

  return (
    <aside className="controls-panel" id="controls-panel">
      {/* ─── Canvas Format ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Canvas</div>
        <div className="control-group">
          <div className="segmented-control" id="format-selector">
            {(Object.keys(CANVAS_PRESETS) as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                className={`segmented-option${canvasSize.format === fmt ? ' active' : ''}`}
                onClick={() => handleFormatChange(fmt)}
                id={`format-${fmt.replace(':', '-')}`}
              >
                {CANVAS_PRESETS[fmt].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Text Content ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Text</div>
        <div className="control-group">
          <textarea
            className="control-textarea"
            value={settings.content}
            onChange={(e) => updateSetting('content', e.target.value)}
            placeholder="Enter your text…"
            id="text-input"
          />
        </div>
      </div>

      {/* ─── Typography ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Typography</div>

        <div className="control-group">
          <div className="control-label">
            Font
          </div>
          <select
            className="control-select"
            value={settings.fontFamily}
            onChange={(e) => updateSetting('fontFamily', e.target.value)}
            id="font-selector"
            style={{ fontFamily: settings.fontFamily }}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <div className="control-label">
            Size <span className="control-label-value">{settings.fontSize}px</span>
          </div>
          <input
            type="range"
            className="control-range"
            min={12}
            max={120}
            value={settings.fontSize}
            onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
            id="font-size-slider"
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            Line Height <span className="control-label-value">{settings.lineHeight}px</span>
          </div>
          <input
            type="range"
            className="control-range"
            min={12}
            max={160}
            value={settings.lineHeight}
            onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
            id="line-height-slider"
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            Text Start Y <span className="control-label-value">{settings.textStartY}px</span>
          </div>
          <input
            type="range"
            className="control-range"
            min={0}
            max={canvasSize.height}
            value={settings.textStartY}
            onChange={(e) => updateSetting('textStartY', Number(e.target.value))}
            id="text-start-slider"
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            Padding <span className="control-label-value">{settings.padding}px</span>
          </div>
          <input
            type="range"
            className="control-range"
            min={0}
            max={120}
            value={settings.padding}
            onChange={(e) => updateSetting('padding', Number(e.target.value))}
            id="padding-slider"
          />
        </div>
      </div>

      {/* ─── Alignment ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Alignment</div>

        <div className="control-group">
          <div className="control-label">Text Side</div>
          <div className="segmented-control" id="side-selector">
            {(['left', 'right', 'both'] as TextSide[]).map((s) => (
              <button
                key={s}
                className={`segmented-option${settings.side === s ? ' active' : ''}`}
                onClick={() => updateSetting('side', s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <div className="control-label">Text Align</div>
          <div className="segmented-control" id="align-selector">
            {(['left', 'center', 'right'] as TextAlignment[]).map((a) => (
              <button
                key={a}
                className={`segmented-option${settings.alignment === a ? ' active' : ''}`}
                onClick={() => updateSetting('alignment', a)}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Color ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Color</div>
        <div className="control-group">
          <div className="control-color-input">
            <div className="control-color-swatch" style={{ backgroundColor: settings.color }}>
              <input
                type="color"
                value={settings.color}
                onChange={(e) => updateSetting('color', e.target.value)}
                id="color-picker"
              />
            </div>
            <div className="control-color-presets">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`control-color-preset${settings.color === c ? ' active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => updateSetting('color', c)}
                  aria-label={`Set color to ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Image Adjustment ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Image</div>

        <div className="control-group">
          <div className="control-label">
            Scale <span className="control-label-value">{(imageTransform.scale * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            className="control-range"
            min={50}
            max={300}
            value={imageTransform.scale * 100}
            onChange={(e) => updateTransform('scale', Number(e.target.value) / 100)}
            id="image-scale-slider"
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            Overlay <span className="control-label-value">{(settings.overlayOpacity * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            className="control-range"
            min={0}
            max={80}
            value={settings.overlayOpacity * 100}
            onChange={(e) => updateSetting('overlayOpacity', Number(e.target.value) / 100)}
            id="overlay-slider"
          />
        </div>
      </div>

      {/* ─── Effects ─── */}
      <div className="controls-section">
        <div className="controls-section-title">Effects</div>
        <div className="control-group">
          <div className="toggle-row">
            <span className="control-label" style={{ marginBottom: 0 }}>3D Subject Overlay</span>
            <div
              className={`toggle-switch${settings.enable3dEffect ? ' active' : ''}`}
              onClick={() => updateSetting('enable3dEffect', !settings.enable3dEffect)}
              role="switch"
              aria-checked={settings.enable3dEffect}
              id="3d-toggle"
            >
              <div className="toggle-switch-knob" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="controls-section" style={{ borderBottom: 'none', marginTop: 'auto' }}>
        <button className="btn-secondary" onClick={onNewImage} style={{ width: '100%' }} id="new-image-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          New Image
        </button>
      </div>
    </aside>
  )
}
