<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/e/ec/Type_design_icon.svg" width="80" alt="Logo"/>
  <h1>Contour</h1>
  <p><strong>Browser-based creative text layout tool. Flow text around subjects with local AI.</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#how-it-works">How It Works</a> •
    <a href="#running-locally">Local Setup</a> •
    <a href="#deployment">Deployment</a>
  </p>
</div>

<br />

> Contour brings magazine-style text flow to the web. Upload any image with a clear subject, type your text, and watch it automatically wrap around the silhouette—all powered by a local AI model running completely privately in your browser.

---

## ✨ Features

- **🧠 Local AI Subject Detection:** Powered by [`@imgly/background-removal`](https://github.com/imgly/background-removal-js), processing happens entirely on your device using WebAssembly.
- **🖋️ Custom Greedy Line Breaker:** Wraps text line-by-line tightly around organic subject bounds.
- **🎨 Carbon Soft Touch UI:** A beautiful, responsive editor with glassmorphic and clean geometric design.
- **✨ 3D Depth Overlays:** Places the subject *in front* of the text while maintaining the original background.
- **📱 Instagram-Ready Exports:** Perfect presets for Square (1:1), Portrait (4:5), and Story (9:16).
- **🔒 100% Private:** No backend. No data leaves the browser.

## 🛠️ Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **AI/ML:** ONNX + WebAssembly (via imgly)
- **Styling:** Custom CSS Custom Properties
- **Rendering:** HTML5 Canvas Compositor

## 🚀 How It Works

1. **Upload:** User drops an image (JPG/PNG/WEBP).
2. **Detect:** The AI runs locally, returning a blob mask of the subject.
3. **Scan:** The app scans the alpha channel to calculate left/right boundaries row-by-row.
4. **Layout:** A greedy text-breaking algorithm measures fonts to fit words into the remaining horizontal space.
5. **Render:** Background → Text → Foreground Subject (optional) are layered onto the canvas.

## 💻 Running Locally

### Prerequisites
- Node.js 18+

### Setup

```bash
# Clone the repository (if you haven't already)
git clone <your-repo-url>
cd contour

# Install dependencies
npm install

# Start the development server
npm run dev
```

Visit `http://localhost:5173` to view the app!

## 🌍 Deployment

### Vercel (Recommended)

Contour is a purely static client-side app, making it perfect for Vercel.

1. **Install the Vercel CLI:**
   ```bash
   npm i -g vercel
   ```
2. **Deploy:**
   ```bash
   vercel --prod
   ```

Alternatively, you can connect your GitHub repository directly to Vercel via their web dashboard for automatic deployments.

---

<p align="center">
  Crafted with ❤️ for creators and designers.
</p>
