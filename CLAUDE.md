# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Beam is

Beam gives an AI agent (or test script, or human) **wireless hands and eyes on a real Android
phone** — read the screen, tap by element, type, swipe — with **no ADB, no USB, no developer
mode**. Install one app, enable Accessibility once, connect over Wi-Fi. That zero-setup,
real-device path is the entire point; the ROADMAP's hard rule is *nothing may add a step to the
core workflow* (install → enable Accessibility → connect → drive).

## Two apps, one wire protocol

This is a monorepo of two independently-built apps that talk over a single TCP socket:

- **[beam-android/](beam-android/)** — the *sender* / device agent. Expo (React Native) UI driving
  a Kotlin native module (`modules/beam-capture`) that captures the screen (`MediaProjection` +
  hardware `MediaCodec` H.264) and executes control ops (`AccessibilityService`).
- **[beam-windows/](beam-windows/)** — the *receiver* / host. Electron + React + TypeScript. Decodes
  H.264 with browser-native **WebCodecs** (no FFmpeg, no native addons), shows the live screen, and
  exposes a localhost JSON-RPC control relay on `127.0.0.1:8788`.

[PROTOCOL.md](PROTOCOL.md) is the **single source of truth** for the wire format (v2: multiplexed
channels — ch0 video, ch1 control). Any change to framing, ops, or HELLO must keep `beam-android`,
`beam-windows/src/shared/protocol.ts`, and DroidPilot's `BeamTransport` in agreement. The phone is
the socket *server* (port 8787, +10 for the additive TLS listener); the PC is the client.

[DroidPilot](https://github.com/LioMatthys/droidpilot) is a separate repo — a Python MCP server that
connects to the `:8788` relay so an agent drives the phone via standard tool calls. Control op names
match DroidPilot's tool surface 1:1 by design.

## Commands

### beam-windows (Electron)
```powershell
cd beam-windows
npm install
npm run dev          # hot-reload dev (electron-vite)
npm run typecheck    # tsc over node (main/preload) + web (renderer) — run before committing
npm run build        # type-checked production bundle into out/
npm run package         # Windows installer Beam-Setup.exe + portable, into dist/
npm run package:linux   # Linux AppImage + .deb
```
Decode smoke test (headless WebCodecs): `test/decode-smoke/` — run `main.js` via electron.

### beam-android (Expo + Kotlin)
```powershell
cd beam-android
npm install
npm run lint                              # expo lint
npx expo run:android                      # prebuild + compile native module + install
```
**Cannot run in Expo Go** — the native capture module requires a custom dev build. See
[beam-android/README.md](beam-android/README.md) for the full toolchain (JDK 21 from Android Studio
JBR, android-36) and the **machine-specific Gradle 9 / foojay workaround** (a JDK 17 at
`C:/tmp/jdk17/...` passed as Gradle *CLI flags*, because `expo run:android` won't forward them).
Fastest soundness check without a device/NDK:
`cd android && .\gradlew.bat :beam-capture:compileDebugKotlin -D...` (flags in the README).

The release APK is built in the cloud via **EAS** (`eas.json`), not locally — separate from the
desktop CI.

## Architecture notes

**Frame flow (windows):** `main` (`net.Socket` → `frame-parser.ts` reassembly) → MessageChannel →
`renderer` (`decoder.ts` `BeamDecoder` → `<canvas>`). Status uses a normal IPC channel. The decode
path expects **Annex-B** H.264 with no `description`; SPS/PPS arrive as a CONFIG frame and are
prepended to keyframes. `control-relay.ts` is pure plumbing — forwards `:8788` JSON to the phone's
ch1 and matches responses by `id`; no agent/model logic lives there. Shared wire types in
`src/shared/`; the agent onboarding prompt is `src/shared/agent-prompt.ts`.

**Android module (`modules/beam-capture/android/.../beamcapture/`):** `BeamCaptureModule.kt` is the
JS bridge; `ScreenCaptureService.kt` is the foreground service (projection → `H264Encoder.kt` →
`BeamServer.kt`); `BeamControlService.kt` is the AccessibilityService backing control ops;
`BeamTls.kt` is the self-signed-cert TLS listener; `Protocol.kt` holds wire constants. The RN/Expo
layer (`src/`) only renders UI and drives the module via `data/connection-context.tsx`. UI is
i18n'd (French default + English).

**Design:** both apps share one dark theme, apricot → flashy-blue gradient (Tempo design tokens in
`theme.ts` on each side). `icon-render/` is a standalone Node script (`@napi-rs/canvas`) that renders
the app icon; `docs/` is the GitHub Pages site.

## Conventions

- **Read the versioned Expo docs before writing Expo code:** https://docs.expo.dev/versions/v56.0.0/
  (per `beam-android/AGENTS.md` — Expo v56 changed significantly).
- **Versioning** (ROADMAP): `1.0.x` for fixes/polish/additive features that don't change the model;
  a major feature (audio, cloud relay, multi-device GA) earns `2.0`. `beam-windows/package.json`
  version is bumped per release; tagging `v*` triggers the desktop release workflow.
- **Security posture:** CONTROL is full remote input + UI/screen read, so it stays **LAN-only**,
  gated by an on-phone per-session consent toggle and the 6-digit pairing code (sent inside TLS).
  TLS uses trust-on-first-use fingerprint pinning. A real PAKE and a remote relay are explicitly
  *future* work — don't assume they exist.
