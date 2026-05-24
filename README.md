# Contour v1-classic 🌀🖋️

<p>
  <img src="https://img.shields.io/badge/AI_Inference-Local_WebAssembly-0f62fe?style=for-the-badge&logo=webassembly&logoColor=white" alt="Local Wasm" />
  <img src="https://img.shields.io/badge/Privacy-100%25_Offline_Sandbox-00f2fe?style=for-the-badge&logo=shield&logoColor=white" alt="Client Privacy" />
  <img src="https://img.shields.io/badge/Framework-React_18_+_Vite-0f62fe?style=for-the-badge&logo=react&logoColor=black" alt="React + Vite" />
</p>

Contour v1-classic is a browser-based creative text layout tool that allows you to flow text beautifully around visual subjects completely offline using a local AI sandbox.

> Contour brings magazine-style text flow to the web. Upload any image with a clear subject, type your text, and watch it automatically wrap around the silhouette—all powered by a local AI model running completely privately in your browser.

---

## ✨ Features

- **🧠 Local AI Subject Detection:** Powered by [`@imgly/background-removal`](https://github.com/imgly/background-removal-js), processing happens entirely on your device using WebAssembly.
- **🖋️ Custom Greedy Line Breaker:** Wraps text line-by-line tightly around organic subject bounds.
- **🎨 Carbon Soft Touch UI:** A beautiful, responsive editor with glassmorphic and clean geometric design.
- **✨ 3D Depth Overlays:** Places the subject *in front* of the text while maintaining the original background.
- **📱 Instagram-Ready Exports:** Perfect presets for Square (1:1), Portrait (4:5), and Story (9:16).
- **🔒 100% Private:** No backend. No data leaves the browser.

---

## 🛠️ Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **AI/ML:** ONNX + WebAssembly (via imgly)
- **Styling:** Custom CSS Custom Properties
- **Rendering:** HTML5 Canvas Compositor

---

## 🚀 How It Works

1. **Upload:** User drops an image (JPG/PNG/WEBP).
2. **Detect:** The AI runs locally, returning a blob mask of the subject.
3. **Scan:** The app scans the alpha channel to calculate left/right boundaries row-by-row.
4. **Layout:** A greedy text-breaking algorithm measures fonts to fit words into the remaining horizontal space.
5. **Render:** Background → Text → Foreground Subject (optional) are layered onto the canvas.

---

## 💻 Running Locally

### Prerequisites
- Node.js 18+

### Setup

```bash
# Clone the repository
git clone https://github.com/Anuj-9009/contour.git
cd contour

# Install dependencies
npm install

# Start the development server
npm run dev
```

Visit `http://localhost:5173` to view the app!

---

<div align="center" style="margin-top: 40px;">
  <img src="assets/footer-v2.svg" width="100%" alt="footer">
</div>
<p style="font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: #0f62fe; margin: 0; text-align: center;">
  built by ANUJ with ❤️ while frank ocean's 'Novacane' played on repeat
</p>
