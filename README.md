# <p align="center"><img src="data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23a78bfa'/%3E%3Cstop offset='100%25' stop-color='%234f46e5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='24' fill='url(%23g)'/%3E%3Cpath d='M25 70C25 50 38 30 50 30C62 30 75 50 75 70' stroke='white' stroke-width='7' stroke-linecap='round' fill='none'/%3E%3Cpath d='M35 65C35 52 42.5 38 50 38C57.5 38 65 52 65 65' stroke='white' stroke-width='4' stroke-linecap='round' fill='none' opacity='0.6'/%3E%3Ccircle cx='50' cy='30' r='4' fill='white'/%3E%3C/svg%3E" width="100" height="100" alt="Contour Logo"/><br>C O N T O U R</p>

<p align="center">
  <strong>An elegant, browser-based typography engine that wraps text tightly around your photo's subject in real-time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI_Inference-Local_WebAssembly-8b5cf6?style=for-the-badge&logo=webassembly&logoColor=white" alt="Local Wasm AI"/>
  <img src="https://img.shields.io/badge/Privacy-100%25_Client--side-10b981?style=for-the-badge&logo=shield&logoColor=white" alt="100% Client-Side Privacy"/>
  <img src="https://img.shields.io/badge/Framework-React_18_+_Vite-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React + Vite"/>
  <a href="https://contour-jmlq86cmo-anuj-9009s-projects.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Live_Demo-Active-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo"/>
  </a>
</p>

---

<div align="center">
  <h3>✨ See the Flow. Craft the Canvas. ✨</h3>
  <p>
    Contour brings high-end magazine-cover layouts straight to your web browser. Upload an image, watch our local AI extract your subject, and type text that dynamically flows around the silhouette—entirely inside your browser. No data ever leaves your device.
  </p>
  <br/>
  <a href="https://contour-jmlq86cmo-anuj-9009s-projects.vercel.app" target="_blank" style="text-decoration: none;">
    <strong>🚀 Try the Live Application &rarr;</strong>
  </a>
</div>

<br/>

## 🎯 Features at a Glance

<table align="center" style="width: 100%; border-collapse: collapse; border: none;">
  <tr style="border: none;">
    <td width="50%" style="padding: 15px; border: none; vertical-align: top;">
      <h3>🧠 Local subject extraction</h3>
      <p>Powered by <code>@imgly/background-removal</code> running ONNX models in WebAssembly. Silhouettes are extracted fully client-side in under 3 seconds.</p>
    </td>
    <td width="50%" style="padding: 15px; border: none; vertical-align: top;">
      <h3>🖋️ Custom Greedy Line-Breaker</h3>
      <p>A high-performance paragraph scanner that measures font geometry row-by-row to wrap text tightly and cleanly around subjects.</p>
    </td>
  </tr>
  <tr style="border: none;">
    <td width="50%" style="padding: 15px; border: none; vertical-align: top;">
      <h3>🎨 Carbon Soft Touch Design</h3>
      <p>A premium minimal interface. Built with micro-animations, custom HSL range sliders, dynamic focus rings, and soft glassmorphism.</p>
    </td>
    <td width="50%" style="padding: 15px; border: none; vertical-align: top;">
      <h3>🎭 3D Depth layering</h3>
      <p>Place your subject dynamically <em>in front</em> of your text layer while keeping the original image background intact for a premium 3D composition.</p>
    </td>
  </tr>
</table>

---

## 🚀 Interactive How-It-Works Flowchart

Here's how Contour performs local computer vision and custom typesetting in real-time under the hood:

```mermaid
graph TD
    A[🖼️ User Uploads Image] --> B[🧠 WebAssembly Model Loads]
    B --> C[✂️ Subject Silhouette Extracted]
    C --> D[🔍 Scan Alpha Channels Row-by-Row]
    D --> E[📐 Calculate Pixel Boundaries]
    E --> F[🖋️ Greedy Typesetter Fits Text]
    F --> G[🎨 Canvas Composites Layers]
    G --> H[💾 Instant High-Res Export]
    
    style A fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px
    style C fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style F fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px
    style H fill:#d1fae5,stroke:#059669,stroke-width:2px
```

---

## 💻 Get Started Locally

Get a local copy running in less than a minute!

```bash
# Clone this repository
git clone https://github.com/Anuj-9009/contour.git

# Navigate into the project directory
cd contour

# Install dependencies
npm install

# Launch Vite dev server
npm run dev
```

Open your browser to `http://localhost:5173` and start creating.

---

## 💡 Inspiration & Credits

Contour's line-wrapping and paragraph typesetting engine was inspired by the pioneering work in the [`@chenglou/pretext`](https://github.com/chenglou/pretext) repository. 

Pretext demonstrated that dynamic, browser-native typography wrapping around arbitrary shapes is possible using clean, greedy mathematical layouts rather than relying on heavy graphic editing suites. Contour adapts and extends these core design paradigms for modern React + TypeScript applications.

---

## 🛡️ Privacy Guarantee

Your photos never leave your device. Contour uses state-of-the-art WebAssembly compilers to run advanced AI models completely in the browser sandbox. Because we do not use a backend API, your media remains 100% private, local, and secure.

---

<p align="center">
  Made with 🤍 for designers and developers alike.
</p>
