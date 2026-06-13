# Beam

Mirror your Android phone's screen to your Windows PC over Wi-Fi. No USB cable, no
developer options, no Google Cast. Install the app, put both devices on the same
network, type a code, done.

Two apps, one wire protocol ([`PROTOCOL.md`](./PROTOCOL.md)):

| | What it is | Stack |
|---|---|---|
| [`beam-android/`](./beam-android) | The **sender** — captures and streams the phone screen | Expo (React Native) UI + a Kotlin native capture module |
| [`beam-windows/`](./beam-windows) | The **receiver** — displays the stream | Electron + React + TypeScript, H.264 decode via WebCodecs |

Both share the same dark, lime→teal visual language (the "Tempo" design system).

## How it works

1. The phone captures its screen with `MediaProjection`, encodes it to H.264 with the
   hardware `MediaCodec` encoder, and serves the stream over a TCP socket.
2. The PC connects, receives length-prefixed H.264 frames, decodes them with the
   browser-native `VideoDecoder` (WebCodecs, hardware-accelerated), and paints each
   frame to a `<canvas>`.

## v1 scope

- ✅ Live screen mirroring (phone → PC), Wi-Fi, same network.
- ⛔ Remote control (mouse/keyboard back to the phone) — deferred.
- ⛔ Audio — deferred.

## Build status

| Piece | State |
|---|---|
| Windows receiver — typecheck + production build | ✅ clean |
| Windows receiver — WebCodecs H.264 decode | ✅ proven (30/30 frames, headless test) |
| Windows receiver — app launches | ✅ boots, no runtime errors |
| Android app — TypeScript | ✅ typecheck clean |
| Android — native Kotlin module compile | ✅ `BUILD SUCCESSFUL` (`:beam-capture:compileDebugKotlin`) |
| Android — `expo prebuild` + autolinking | ✅ works |
| End-to-end mirror (phone → PC) | ⏳ needs a physical device/emulator (none connected) |

Android build needs JDK 17 + Gradle CLI toolchain flags — see
[`beam-android/README.md`](./beam-android/README.md#-toolchain-note-this-machine).

## Quick start

### Windows receiver
```powershell
cd beam-windows
npm install
npm run dev
```
Opens the Beam window. Enter the phone's IP, port, and the 6-digit code it shows.

### Android sender
```powershell
cd beam-android
npm install
npx expo run:android   # builds the custom dev client (NOT Expo Go — needs native code)
```
Tap "Démarrer le partage", accept the screen-capture prompt, read off the IP + code.

See each app's own README for details and prerequisites.
