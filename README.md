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
[**Releases page**](https://github.com/LioMatthys/Beam/releases/latest), or use the Windows
app's **"Install on Android (USB)"** button.

<br clear="right" />

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
| Android APK (English UI, survives screen lock) | ✅ built on EAS, published as [`v0.1.0`](https://github.com/LioMatthys/Beam/releases/tag/v0.1.0) |
| Windows receiver — portable build | ✅ `Beam-windows-x64.zip` published on [`v0.1.0`](https://github.com/LioMatthys/Beam/releases/tag/v0.1.0) (no Node needed) |
| One-click USB install (Windows "Install on Android" button) | ✅ built (downloads the release APK via adb) |
| End-to-end mirror (phone → PC) | ⏳ install the APK and try it — not yet run against a live device here |

The APK is built in the cloud (EAS) because the local native build hits this machine's
toolchain limits (JDK 17 / Gradle 9.3.1 foojay / NDK link) — see
[`beam-android/README.md`](./beam-android/README.md#-toolchain-note-this-machine).

## Quick start

### Windows receiver

**Ready-made (no Node needed):** download **[Beam-windows-x64.zip](https://github.com/LioMatthys/Beam/releases/latest)**,
extract it, and run `Beam\Beam.exe`. (Unsigned build, so Windows SmartScreen shows
"More info → Run anyway" the first time — normal for indie apps.)

**From source:**
```powershell
cd beam-windows
npm install
npm run dev
```
Opens the Beam window. Enter the phone's IP, port, and the 6-digit code it shows.

### Android sender

The phone app ships as an APK (it has native code, so it can't run in Expo Go).
Easiest install — straight from the **Windows app**:

1. Connect the phone by USB with **USB debugging** enabled and authorized.
2. In the Beam window, click **"Install on Android (USB)"** — it downloads the APK,
   `adb install`s it (no "unknown sources" prompt), and launches it.

Or install manually: grab **[Beam.apk from Releases](https://github.com/LioMatthys/Beam/releases/latest)**,
copy it to the phone, and tap it (allow "install unknown apps").

Then on the phone tap **"Start sharing"** → **"Start now"**, and read off the IP and
6-digit code to type into the Windows app. The connection survives a screen lock and
resumes on unlock.

> **Developing the phone app** with hot reload needs a local native toolchain this
> machine doesn't fully have (JDK 17 / Gradle / NDK — see
> [`beam-android/README.md`](./beam-android/README.md)), or build a dev client with
> `eas build --profile development`.

See each app's own README for details and prerequisites.
