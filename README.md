# Wingman 🚀

A modern, cross-browser extension for OmeTV built with Manifest V3 and WXT. Wingman intelligently automates partner matchmaking preferences, allowing users to filter partner connections and auto-skip matches based on gender metadata.

---

## ✨ Features

- **🎯 Smart Gender Filtering**: Automatically identifies incoming stranger metadata and skips male matches, connecting only with desired preferences.
- **⚡ Fast & Lightweight**: Zero external telemetry or heavy dependencies. Fast matchmaking response times.
- **🛡️ Anti-Detection Protection**: Randomized human-like skip delays and throttled actions to avoid rapid-skip rate limits or automated bot detection.
- **🌐 Cross-Browser Support**: Built on Manifest V3, compatible with Google Chrome, Brave, Firefox, Microsoft Edge, and Opera.
- **🎛️ Interactive Popup Dashboard**: Toggle auto-skip on/off, customize skip speeds, and monitor real-time skip statistics.

---

## 🛠️ Tech Stack

- **Framework**: [WXT](https://wxt.dev/) (Next-gen Web Extension framework)
- **Runtime Standard**: Manifest V3 (MV3)
- **Language**: TypeScript
- **Bundler**: Vite
- **UI**: HTML / CSS / TailwindCSS

---

## 📂 Project Structure

```text
wingman/
├── entrypoints/
│   ├── background.ts         # Extension service worker (settings & state management)
│   ├── content.ts            # Content script running on ome.tv (event listener & skipper)
│   └── popup/                # Extension popup dashboard
│       ├── index.html
│       ├── main.ts
│       └── style.css
├── modules/
│   ├── ometv/
│   │   ├── interceptor.ts    # WebSocket & DOM match detection
│   │   ├── skipper.ts        # Human-like skip trigger & cooldown logic
│   │   └── types.ts          # Match payloads and configuration types
│   └── storage.ts            # Browser storage wrapper for user settings
├── assets/
│   └── icons/                # Extension icons (16px, 48px, 128px)
├── wxt.config.ts             # WXT extension configuration
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `pnpm`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/arnavsx3/wingman.git
   cd wingman
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development Mode

Start the live-reloading dev server:

```bash
# Target Chrome (default)
npm run dev

# Target Firefox
npm run dev:firefox
```

This will automatically launch a dedicated browser instance with the extension loaded and Hot Module Reloading (HMR) enabled.

### Building for Production

Compile production-ready extension bundles for distribution:

```bash
# Build for Chrome / Chromium browsers (Brave, Edge, Opera)
npm run build

# Build for Firefox
npm run build:firefox
```

The output packages will be generated in the `.output/` directory ready for loading into `chrome://extensions` or packaging for the Web Store.

---

## ⚠️ Disclaimer

This project is created for educational and personal use only. The developers are not affiliated with, authorized, maintained, or endorsed by OmeTV or its parent entities. Use responsibly and adhere to the platform's terms of service.

---

## 📄 License

[MIT](LICENSE)
