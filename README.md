# <p align="center"><img src="data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230f62fe'/%3E%3Cstop offset='100%25' stop-color='%2300f2fe'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='24' fill='url(%23g)'/%3E%3Cpath d='M25 70C25 50 38 30 50 30C62 30 75 50 75 70' stroke='white' stroke-width='7' stroke-linecap='round' fill='none'/%3E%3Cpath d='M35 65C35 52 42.5 38 50 38C57.5 38 65 52 65 65' stroke='white' stroke-width='4' stroke-linecap='round' fill='none' opacity='0.6'/%3E%3Ccircle cx='50' cy='30' r='4' fill='white'/%3E%3C/svg%3E" width="100" height="100" alt="Contour Logo"/><br>C O N T O U R &nbsp; v2.0</p>

<p align="center">
  <strong>The Ultimate Client-Side Kinetic Video & Photo Typography Workspace</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI_Inference-Local_WebAssembly_%26_WebGPU-8b5cf6?style=for-the-badge&logo=webassembly&logoColor=white" alt="Local Wasm/WebGPU AI"/>
  <img src="https://img.shields.io/badge/Privacy-100%25_Offline_Sandbox-10b981?style=for-the-badge&logo=shield&logoColor=white" alt="100% Client-Side Privacy"/>
  <img src="https://img.shields.io/badge/Framework-React_18_+_Vite-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React + Vite"/>
  <a href="https://github.com/Anuj-9009/contour/tree/v1-classic" target="_blank">
    <img src="https://img.shields.io/badge/Version_1.0-Archived_Branch-ff9800?style=for-the-badge&logo=git&logoColor=white" alt="Version 1.0 Branch"/>
  </a>
</p>

---

<div align="center">
  <h3>✨ Kinetic Canvas. 3D Subject Depth. Zero-Server Privacy. ✨</h3>
  <p>
    <strong>Contour v2.0 (Kinetic Azure Expansion)</strong> scales our browser-based subject typography engine into a fully animated video typesetting studio. Transcribe vocals using client-side AI, sync text to background beats with a tapping console, and wrap lyrics tightly around moving subject curves. All rendering, speech-to-text, and video compiling runs <strong>100% locally in your browser sandbox</strong>.
  </p>
  <br/>
</div>

---

## ⚡ Key Highlights of the v2.0 Azure Expansion

### 🎭 Concurrency-Safe Video subject Isolation
* **Parallel-Seeking Extraction**: Spawns 3 parallel offscreen video elements to seek and grab raw frame `ImageData` concurrently in under 2 seconds. Video elements are cleared immediately to free up browser resources.
* **Sequential AI Inference**: Loops through cached frames sequentially to evaluate subject silhouettes. This completely eliminates resource thrashing, memory fragmentation, and silent WebGPU thread locks in the shared ONNX Runtime context, guaranteeing 100% stability.
* **Resilient CPU Fallback**: WebGPU and WebAssembly initialization are wrapped in `Promise.race` timeout races (7s for video, 8s for static photos). If the browser context fails or compiles silently freeze due to driver incompatibilities, the engine falls back to CPU processing seamlessly without interrupting the user.

### 🌀 Alphabetic In-Place Twinkling Matrix Backdrop
* **Pixel-Perfect Exclusion Curves**: Replaces rectangular bounding slabs with dynamic canvas alpha mapping. The text layers are pre-rendered onto a hidden offscreen canvas to obtain a high-fidelity alpha map. Characters are sampled in a 9-point radial neighborhood to form a tight `8px` contour halo that perfectly wraps around individual letter shapes!
* **In-Place Twinkling**: Refactors spatial math to avoid sliding horizontal movement. Every character stays locked in its grid coordinate and twinkles independently at high speed.
* **Alphabet-Only**: Restricted character sets strictly to upper and lowercase letters (`A-Z`, `a-z`) for a highly polished editorial aesthetic.

### 🎤 Timeline & Speech-to-Text syncing Console
* **Offline AI Transcribing**: Integrates local `Transformers.js` Whisper-Tiny ASR. Resamples uploaded audio tracks to 16kHz mono Float32 PCM inside the browser, and transcribes timestamps completely offline.
* **Tactile Spacebar Beat Tapper**: Paste plain text and tap your spacebar to stamp current millisecond timing offsets dynamically during playback.
* **LRC Timing File Ingestion**: Features an upgraded, BOM-safe parser that handles UTF-8 Byte Order Marks, variable millisecond padded brackets (`[mm:ss.xx]`, `[mm:ss.xxx]`), and supports empty lines to clear out active lyrics during instrumental breaks.

### 💾 Lossless WebAssembly Export
* Compiles your projects directly to MP4 using `ffmpeg.wasm` with custom aspect crops (`1:1`, `4:5`, `9:16`), customizable bitrates, and live estimated output file size indicators. Includes an automatic client-side stream capture fallback.

---

## 📊 Dual-Mode Ingestion Pipeline Architecture

Our typesetter combines local WebAssembly machine learning with custom row-fitting greedy typesetting algorithms to keep all processes 100% client-side:

```mermaid
flowchart TD
    A["Upload Ingestion (Dropzone)"] -->|Photo / HEIC| B["Classic Photo Mode"]
    A -->|MP4 / MOV| C["Synced Video Mode"]
    
    subgraph Photo Processing
        B --> D["@imgly/background-removal\n(ONNX subject mask)"]
        D --> E["Wrapping boundary calculation\n(Inner Padding + Subject Offset)"]
        E --> F["Static text flow wrapping"]
      style D fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px
    end
    
    subgraph Video Processing
        C --> G["Video element frame extraction\n(15 FPS downscaled decoder)"]
        G --> H["Client-side frame segmenter\n(5 FPS sampling + quint8 model)"]
        H --> I["Linear RowBounds interpolation\n(Reconstructs full 15 FPS bounds)"]
        H --> J["RLE Mask propagation\n(Compreses masks < 15MB RAM)"]
        
        C --> K["Audio vocal extraction & resampling\n(16kHz mono Float32 PCM)"]
        K --> L["Three Lyric Sync Channels"]
        
        subgraph Lyric Sync Channels
            L -->|Option 1| M["Direct LRC upload & parsing"]
            L -->|Option 2| N["Interactive Spacebar Beat Tapper"]
            L -->|Option 3| O["Offline local AI Whisper ASR"]
        end
      style H fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
      style O fill:#d1fae5,stroke:#059669,stroke-width:2px
    end
    
    F --> P["Canvas preview & 3D foreground compositor"]
    I & J --> P
    M & N & O --> P
    
    P --> Q["Unified Exporter (ExportButton)"]
    Q --> R["WASM H.264 compile + audio mux\n(FFmpeg.wasm / Fallback MediaRecorder)"]
    R --> S["Lossless output MP4 / PNG"]
```

---

## 💻 Local Development Setup

Clone the project and start creating in less than a minute!

```bash
# 1. Clone this repository
git clone https://github.com/Anuj-9009/contour.git

# 2. Navigate into the project folder
cd contour

# 3. Install NPM dependencies
npm install

# 4. Launch Vite development server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 🗂️ Version 1.0 Preservation (Classic Photo Mode)

We have fully archived the original, plain-photo **Version 1.0** release of Contour to make sure it is completely safe and accessible. You can access or branch from the classic photo edition at any time via:

* **GitHub Branch**: [`v1-classic`](https://github.com/Anuj-9009/contour/tree/v1-classic)
* **GitHub Release Tag**: [`v1.0.0`](https://github.com/Anuj-9009/contour/releases/tag/v1.0.0)

To check out the classic version locally:
```bash
git checkout v1-classic
```

---

## 💡 Credit & Deep Inspiration: Pretext

Contour's custom row-fitting greedy typography wrapped layouts were heavily inspired by the pioneering typesetting logic in the [**`@chenglou/pretext`**](https://github.com/chenglou/pretext) repository.

Pretext proved that browser-native editorial wrapping around complex subject contours is possible by scanning alpha boundaries and using custom, greedy mathematical line-breaking models. Contour builds upon this brilliant layout model, extending it for dynamic timeline synchronizations, 3D compositing overlays, in-place matrix warp grids, and client-side neural network acceleration. We owe a huge debt of gratitude to the original Pretext codebase for paving the way!

---

## 🛡️ Privacy Sandboxing Guarantee

Contour uses advanced client-side WebAssembly compilers and local machine learning models (Whisper-ASR, Isnet-Segmentation) running in the secure offline browser sandbox. No pictures, videos, or audio tracks are ever uploaded or transmitted to external servers. Your creative assets remain **100% private, secure, and under your control**.

---

<p align="center">
  Made with 🤍 for designers and developers alike.
</p>
