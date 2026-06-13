# Beam — Windows receiver

Electron + React + TypeScript desktop app that displays a phone screen streamed
over Wi-Fi. H.264 is decoded with **WebCodecs** (hardware-accelerated, built into
Chromium — no FFmpeg, no native addons).

## Run (dev)

```powershell
npm install
npm run dev
```

Enter the phone's **IP**, **port** (default 8787) and the **6-digit code** the phone
shows, then click *Connecter*.

No phone yet? Click **« Tester le décodeur (sans téléphone) »** — it runs a local
encode→decode loopback so you can confirm the video pipeline renders.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Launch with hot reload (electron-vite). |
| `npm run build` | Type-checked production bundle into `out/`. |
| `npm run typecheck` | `tsc` over main/preload + renderer. |
| `npm run package` | Build + `electron-builder` → portable `.exe` in `dist/`. |
| `node test/decode-smoke/main.js` (via electron) | Headless WebCodecs decode smoke test. |

## Architecture

```
src/
  shared/      protocol.ts (wire format, mirrors ../../PROTOCOL.md), api.ts
  main/        Electron main: TCP client (connection.ts), frame reassembly
               (frame-parser.ts), window + MessageChannel plumbing (index.ts)
  preload/     contextBridge → window.beam, forwards the frame MessagePort
  renderer/    React UI (Tempo aesthetic)
    src/
      decoder.ts        WebCodecs VideoDecoder → canvas
      demo.ts           local encode→decode self-test
      frame-port.ts     captures the transferred MessagePort (race-free)
      screens/          Connect.tsx, Mirror.tsx
      components/        GradientButton, StatusPill
      theme.ts, index.css   ported Tempo design tokens
```

Frames flow: **main** (`net.Socket` → `FrameParser`) → MessageChannel → **renderer**
(`BeamDecoder` → `<canvas>`). Status flows over a normal IPC channel for the UI.

## Notes

- Decode path expects **Annex-B** H.264 with no `description`; SPS/PPS arrive as a
  CONFIG frame and are prepended to keyframes (see `decoder.ts`).
- If Electron ever launches as plain Node (`app` is undefined), the environment has
  `ELECTRON_RUN_AS_NODE=1` set — clear it before running.
