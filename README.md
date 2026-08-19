# Screen Recorder

English | [简体中文](./README.zh-CN.md)

A Screen Studio–like desktop screen recorder built with Electron: **record raw data while capturing, apply automatic camera motion at export/preview time.**

Instead of baking zoom, cursor styling, and click effects into the recording, this tool captures the screen together with high-frequency mouse/keyboard events, then re-composites everything at render time with a virtual camera — so every effect stays editable after recording.

## Features

- **Screen & window capture** — full screen (primary mode) or single window, via ScreenCaptureKit-backed `getDisplayMedia`
- **Event-driven recording** — mouse trajectory (60–120 Hz polling), clicks, and keystrokes recorded alongside the video into `events.json`
- **Auto camera motion** — zooms into click regions with spring-damped animations, falls back to full view when idle
- **Offline export pipeline** — deterministic frame-by-frame rendering in a Worker: WebGL compositor → WebCodecs encoder → MP4 muxing, guaranteed constant frame rate
- **Recording/rendering separation** — low CPU during capture; preview and export share the same virtual-camera render pipeline

> Status: early development. See the [technical design doc](./docs/TECH_DESIGN.md) for the full architecture and milestone plan.

## Tech Stack

- **Electron** + **React** + **TypeScript**, bundled with **electron-vite**
- Screen capture: `desktopCapturer` + `getDisplayMedia`
- Global input: [`uiohook-napi`](https://www.npmjs.com/package/uiohook-napi) + `screen.getCursorScreenPoint` polling
- Rendering: custom WebGL compositor (shared between preview and export)
- Decode/encode/mux: WebCodecs + `mp4-muxer`
- State: **zustand** · UI: **Tailwind CSS** + shadcn/ui

## Getting Started

Requires Node.js 18+.

```bash
# install dependencies (public npm registry, see .npmrc)
npm install

# start in dev mode with HMR
npm run dev

# production build
npm run build

# type checking
npm run typecheck
```

### macOS permissions

The app needs two permissions to work:

- **Screen Recording** — for screen capture
- **Accessibility** — for the global input hook (clicks / keystrokes)

Grant them in *System Settings → Privacy & Security* when prompted, then restart the app.

## Project Structure

```
screen-recorder/
├── electron/               # Main process
│   ├── capture/            # Screen / audio capture
│   ├── input/              # Mouse polling, uiohook events
│   └── store/              # Recording session persistence
├── src/                    # Renderer process (React)
│   ├── components/         # UI
│   ├── recorder/           # Recording control
│   └── store/              # Renderer state
├── shared/                 # Types & IPC contracts shared by both processes
├── docs/TECH_DESIGN.md     # Full technical design (Chinese)
└── sdd/                    # Spec-driven development docs
```

## Recording Data Format

Each session is saved to `recordings/<session-id>/`:

```
├── screen.webm    # raw screen footage
├── mic.wav        # microphone (optional)
└── events.json    # metadata + mouse track, clicks, keys (timestamps relative to recording start)
```

All post-recording effects (zoom, click ripple, keystroke overlay) are derived from `events.json` at render time.
