import { useRef, useState, useCallback } from 'react'

interface Props {
  onUpload: (file: File, type: 'photo' | 'video' | 'audio') => void
  enableGpu: boolean
  onToggleGpu: (val: boolean) => void
  aiModel: 'isnet_fp16' | 'isnet_quint8'
  onChangeAiModel: (val: 'isnet_fp16' | 'isnet_quint8') => void
}

export default function Dropzone({ onUpload, enableGpu, onToggleGpu, aiModel, onChangeAiModel }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback((file: File) => {
    const fileType = file.type
    if (fileType.startsWith('image/')) {
      onUpload(file, 'photo')
    } else if (fileType.startsWith('video/')) {
      onUpload(file, 'video')
    } else if (fileType.startsWith('audio/')) {
      onUpload(file, 'audio')
    } else {
      // Fallback check based on extension
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (['mp4', 'mov', 'webm'].includes(ext || '')) {
        onUpload(file, 'video')
      } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext || '')) {
        onUpload(file, 'audio')
      } else if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext || '')) {
        onUpload(file, 'photo')
      }
    }
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragging(false)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="dropzone-wrapper max-w-6xl mx-auto px-6 py-12 flex flex-col justify-center min-h-[calc(100vh-100px)]">
      {/* Brand Intro Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl mb-3">
          Contour <span className="text-primary-container">v2.0</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-slate-500 font-body">
          The high-fidelity kinetics workshop. Wrap beautiful, animated typography around photo subjects and video silhouettes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Drag & Drop Area */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <div
            className={`dropzone-box flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-300 ${
              dragging
                ? 'border-primary-container bg-primary-lighter/10 scale-[0.99]'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
            }`}
            onClick={triggerUpload}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            id="dropzone"
          >
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-primary-container mb-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-transform duration-300 hover:scale-110">
              <span className="material-symbols-outlined text-3xl">cloud_upload</span>
            </div>

            <h3 className="text-xl font-headline font-bold text-slate-800 dark:text-slate-200 mb-2">
              Ingest your media assets
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 font-body">
              Drag & drop or browse. Accepts high-res **Photos** (JPEG, PNG, RAW) or dynamic **Videos** (MP4, MOV).
            </p>

            <button className="btn-primary flex items-center gap-2 rounded-full px-6 py-2.5 shadow-md bg-primary-container hover:bg-[#0056D2] text-white font-semibold transition-all">
              <span className="material-symbols-outlined text-lg">search</span>
              Browse local files
            </button>

            <div className="flex gap-3 mt-8 text-xs text-slate-400">
              <span className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-800/50">RAW/JPG</span>
              <span className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-800/50">MP4/MOV</span>
              <span className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-800/50">MP3/WAV</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleChange}
              className="hidden"
              id="file-input"
            />
          </div>
        </div>

        {/* Right Column: "Automatic Alignment" Information Card */}
        <div className="md:col-span-5 flex flex-col">
          <div className="info-card flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-6 text-primary-container font-headline font-bold text-lg uppercase tracking-wider">
                <span className="material-symbols-outlined text-xl">security</span>
                Local AI Sandbox
              </div>

              <h3 className="text-2xl font-headline font-bold text-slate-900 dark:text-white mb-4">
                100% Client-Side Processing
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed font-body">
                Contour executes all computation directly in your browser. Your images and video frames never upload to any server, guaranteeing total privacy and instant speed.
              </p>

              {/* Bullet Features */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary-container mt-0.5">blur_on</span>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">AI Mask Segmenter</h4>
                    <p className="text-xs text-slate-400 leading-normal">IMG.LY WASM extracts edge boundaries offline inside sandbox.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary-container mt-0.5">music_note</span>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Offline Voice ASR</h4>
                    <p className="text-xs text-slate-400 leading-normal">Whisper-Tiny WASM transcribes audio in mono 16kHz PCM.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary-container mt-0.5">slow_motion_video</span>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Lossless Frame Muxer</h4>
                    <p className="text-xs text-slate-400 leading-normal">FFmpeg.wasm compiles raw pixel canvas frame arrays into H.264 MP4.</p>
                  </div>
                </div>
              </div>

              {/* Toggle Cards Wrapper */}
              <div className="mt-8 space-y-3">
                {/* GPU Acceleration Toggle Switch Card */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 flex items-center justify-between transition-all hover:border-primary-container/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${enableGpu ? 'bg-primary-container/10 text-primary-container' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      <span className="material-symbols-outlined text-lg">bolt</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">GPU Acceleration</h4>
                      <p className="text-xs text-slate-400">Turbocharge local subject masking using WebGPU</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${enableGpu ? 'active' : ''}`}
                    onClick={() => onToggleGpu(!enableGpu)}
                    aria-checked={enableGpu}
                    role="switch"
                    id="gpu-toggle"
                  >
                    <span className="toggle-switch-knob" />
                  </button>
                </div>

                {/* AI Subject Precision Toggle Switch Card */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 flex items-center justify-between transition-all hover:border-primary-container/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${aiModel === 'isnet_fp16' ? 'bg-primary-container/10 text-primary-container' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      <span className="material-symbols-outlined text-lg">psychology</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">High-Precision AI Mode</h4>
                      <p className="text-xs text-slate-400">Pristine 16-bit FP16 edge quality (highly accurate)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${aiModel === 'isnet_fp16' ? 'active' : ''}`}
                    onClick={() => onChangeAiModel(aiModel === 'isnet_fp16' ? 'isnet_quint8' : 'isnet_fp16')}
                    aria-checked={aiModel === 'isnet_fp16'}
                    role="switch"
                    id="ai-model-toggle"
                  >
                    <span className="toggle-switch-knob" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6 mt-6 flex items-center justify-between text-xs text-slate-400">
              <span>Security State: SECURE</span>
              <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
