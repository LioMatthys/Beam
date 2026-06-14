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

## Get the phone app

<img src="assets/beam-qr-android.png" width="200" align="right" alt="Scan to download Beam.apk" />

**Scan this with your phone's camera** to download the latest `Beam.apk` straight to the
device, then open it to install (allow "install unknown apps"). The QR points at
`releases/latest`, so it keeps working across future releases.

Prefer not to scan? Grab it from the
[**Releases page**](https://github.com/LioMatthys/Beam/releases/latest), or click
**"Download the Android app"** in the Windows app to show the same QR. (USB install lives in
the Windows app's **☰ menu**.)

<br clear="right" />

## How it works

1. The phone captures its screen with `MediaProjection`, encodes it to H.264 with the
   hardware `MediaCodec` encoder, and serves the stream over a TCP socket.
2. The PC connects, receives length-prefixed H.264 frames, decodes them with the
   browser-native `VideoDecoder` (WebCodecs, hardware-accelerated), and paints each
   frame to a `<canvas>`.

## Scope

- ✅ Live screen mirroring (phone → PC), Wi-Fi, same network.
- 🧪 Click-to-control (experimental): click the mirrored screen on the PC to tap the
  phone, via an on-device AccessibilityService you enable per session — see
  [Control from the PC](#control-from-the-pc).
- ⛔ Keyboard / drag / scroll from the PC — not yet (tap only).
- ⛔ Audio — deferred.

Screen capture is always **whole-screen**: the phone forces Android's consent dialog to
"Entire screen" (the "single app" option is removed), so Beam stays in front to show its
IP + code and mirrors everything.

## Build status

| Piece | State |
|---|---|
| Windows receiver — typecheck + production build | ✅ clean |
| Windows receiver — WebCodecs H.264 decode | ✅ proven (30/30 frames, headless test) |
| Windows receiver — app launches | ✅ boots, no runtime errors |
| Android app — TypeScript | ✅ typecheck clean |
| Android — native Kotlin module compile | ✅ `BUILD SUCCESSFUL` (`:beam-capture:compileDebugKotlin`) |
| Android APK (English UI, survives screen lock) | ✅ built on EAS, published as [`v0.1.0`](https://github.com/LioMatthys/Beam/releases/tag/v0.1.0) |
| Windows receiver — installer | ✅ `Beam-Setup.exe` (one-click NSIS) published on [`v0.1.0`](https://github.com/LioMatthys/Beam/releases/tag/v0.1.0) |
| Windows receiver — portable build | ✅ `Beam-windows-x64.zip` published on [`v0.1.0`](https://github.com/LioMatthys/Beam/releases/tag/v0.1.0) (no Node needed) |
| One-click USB install (Windows "Install on Android" button) | ✅ built (downloads the release APK via adb) |
| End-to-end mirror (phone → PC) | ⏳ install the APK and try it — not yet run against a live device here |

The APK is built in the cloud (EAS) because the local native build hits this machine's
toolchain limits (JDK 17 / Gradle 9.3.1 foojay / NDK link) — see
[`beam-android/README.md`](./beam-android/README.md#-toolchain-note-this-machine).

## Quick start

### Windows receiver

**Installer (simplest):** download
**[Beam-Setup.exe](https://github.com/LioMatthys/Beam/releases/latest/download/Beam-Setup.exe)**
and run it — it installs Beam, adds a Start-menu and desktop shortcut, and launches it.
(Unsigned, so Windows SmartScreen shows "More info → Run anyway" the first time — normal for
indie apps.)

**Portable (no install):** download **[Beam-windows-x64.zip](https://github.com/LioMatthys/Beam/releases/latest/download/Beam-windows-x64.zip)**,
extract it, and run `Beam\Beam.exe`.

**From source:**
```powershell
cd beam-windows
npm install
npm run dev
```
Opens the Beam window. Enter the phone's IP, port, and the 6-digit code it shows.

### Android sender

The phone app ships as an APK (it has native code, so it can't run in Expo Go).
Easiest install — **scan a QR**:

1. In the Beam **Windows app**, click **"Download the Android app"** — a **QR code** appears.
2. Scan it with the phone's camera, open the download, and tap to install (allow "install
   unknown apps" if asked).

The QR points at the latest release's `Beam.apk`, so it keeps working across releases. You
can also scan the QR at the top of this page or grab the APK from the
[**Releases page**](https://github.com/LioMatthys/Beam/releases/latest). For a USB install
(adb, no "unknown sources" prompt), use the **☰ menu → Install via USB**.

Then on the phone tap **"Start sharing"** → **"Start now"** (Android asks to capture the
whole screen — there's no "single app" choice), and read off the IP and 6-digit code to
type into the Windows app. The connection survives a screen lock and resumes on unlock.

## Control from the PC

Beam can send taps back to the phone, so you can drive it from the PC (handy for remote
testing). This is **opt-in, per session**, and off by default.

1. On the phone: **Settings → Accessibility → Beam control → On**, and accept the prompt.
   (Sideloaded apps: if the toggle is greyed out, first open **Settings → Apps → Beam →
   ⋮ → Allow restricted settings**.) Turn it on **before** you start sharing, so the phone
   advertises the control channel when it connects.
2. Start sharing and connect from the PC as usual.
3. In the Windows mirror the cursor becomes a **crosshair** when control is live — click
   anywhere on the screen to tap the phone there.

Taps only, for now. The control channel also exposes a localhost JSON-RPC on
`127.0.0.1:8788` for automation tools — see [`PROTOCOL.md`](./PROTOCOL.md).

> **Developing the phone app** with hot reload needs a local native toolchain this
> machine doesn't fully have (JDK 17 / Gradle / NDK — see
> [`beam-android/README.md`](./beam-android/README.md)), or build a dev client with
> `eas build --profile development`.

See each app's own README for details and prerequisites.
