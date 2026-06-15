# Beam

**Wireless hands and eyes for AI agents on a real Android phone. No ADB, no USB, no developer mode.**

Beam lets a program on your computer (an AI agent, a test script, or you) **see and control a
real Android device over Wi-Fi**. Install one app, flip on Accessibility once, and the phone is
drivable from your machine: read what's on screen, tap by element, type, swipe, scroll, wait for
UI. The live screen is mirrored to your PC as the agent's "eyes."

Every other way to do this (Appium, UIAutomator, Maestro, most "mobile-use" agent stacks) needs
ADB, USB debugging, or an emulator. Beam needs none of that. **That frictionless, real-device,
wireless path is the point.**

> **The headline use case:** give your coding agent a real phone to test on. It runs and verifies
> your Android app on an actual device over Wi-Fi, no cable, no `adb`, no emulator rig.

Also good for: mobile QA and regression on real devices, RPA for phone-only apps (no public API),
remote support, and accessibility/assistive control.

---

## How it fits together

```
  Android phone                     Your computer
  ┌───────────────┐                 ┌────────────────────────────┐
  │ Beam app      │  H.264 video →  │ Beam (Windows) app          │
  │ • MediaProjec.│ ───────────────▶│ • live screen (the "eyes")  │
  │ • Accessibility│ ◀───────────── │ • control relay :8788       │
  │   (the "hands")│  control ops ← │                             │
  └───────────────┘    over Wi-Fi   └──────────────┬─────────────┘
                                                    │ localhost JSON-RPC
                                                    ▼
                                        AI agent / DroidPilot (MCP) / your script
```

Two apps, one wire protocol ([`PROTOCOL.md`](./PROTOCOL.md)):

| | What it is | Stack |
|---|---|---|
| [`beam-android/`](./beam-android) | The device agent — captures the screen and executes control ops | Expo (React Native) UI + a Kotlin native module (MediaProjection + AccessibilityService) |
| [`beam-windows/`](./beam-windows) | The host — shows the live screen and exposes a localhost control relay | Electron + React + TypeScript, H.264 decode via WebCodecs |

The control channel is also wired into [**DroidPilot**](https://github.com/LioMatthys/droidpilot), a
Python MCP server, so an agent can drive the phone through standard tool calls.

---

## What the agent can do

All over the same wireless channel, no `adb`. See [`PROTOCOL.md`](./PROTOCOL.md) for the full spec.

| Op | Purpose |
|---|---|
| `dump` | **Read** the screen: every visible element with text, bounds, and selected state |
| `tap_text` | **Navigate** by element (find by text, tap its center) |
| `type_text` | **Fill forms** (set text on the focused field) |
| `swipe` / `long_press` | **Gestures** (scroll, drag, context menus) |
| `scroll_to_element` | **Find off-screen** (auto-scrolls a target into view) |
| `wait_for_text` | **Async-aware** (poll until UI appears, or time out) |
| `back` / `home` | **System navigation** |
| `tap` / `screen_size` | **Raw** coordinate tap + display size |

Because it reads the accessibility tree, it navigates **by element, not by guessed pixels**, so
flows survive layout changes.

---

## Get the phone app

<img src="assets/beam-qr-android.png" width="180" align="right" alt="Scan to download Beam.apk" />

**Scan with your phone's camera** to download the latest `Beam.apk`, then open it to install
(allow "install unknown apps"). The QR points at `releases/latest`, so it keeps working across
releases. Or grab it from the
[**Releases page**](https://github.com/LioMatthys/Beam/releases/latest), or click **"Download the
Android app"** in the Windows app for the same QR.

<br clear="right" />

## Quick start (the whole workflow)

1. **Install the Windows app:**
   [Beam-Setup.exe](https://github.com/LioMatthys/Beam/releases/latest/download/Beam-Setup.exe)
   (or the portable
   [zip](https://github.com/LioMatthys/Beam/releases/latest/download/Beam-windows-x64.zip)).
2. **Install the phone app** (QR above) and, once, enable
   **Settings → Accessibility → Beam control → On**. (Sideloaded? If the toggle is greyed out:
   **Settings → Apps → Beam → ⋮ → Allow restricted settings** first.)
3. **Connect:** tap **Start sharing** on the phone, then enter its IP + 6-digit code in the Windows
   app (or scan to pair). The live screen appears; the connection survives a screen lock.
4. **(Optional) point an agent at it:** the Windows app serves a localhost JSON-RPC on
   `127.0.0.1:8788`. Connect your agent there, or use
   [DroidPilot](https://github.com/LioMatthys/droidpilot) as an MCP.

That's it. No `adb`, no USB cable, no developer options. Steps 1 and 2 are one-time.

You can also drive the phone by hand: the cursor becomes a crosshair over the live screen; click
anywhere to tap the phone there.

---

## Status and honest limits

- **v1.0** — full element-driven control (the ops above) + live mirror, working over Wi-Fi.
- **LAN-only, today.** Traffic is plaintext on the local network, gated by a pairing code. Fine on
  your own Wi-Fi; **not yet safe to expose beyond a trusted network.** Encryption + real auth are
  the first roadmap item.
- **Sideload / enterprise distribution.** Automation via AccessibilityService is restricted on the
  Google Play Store, so Beam distributes as a sideloaded APK (or via MDM). Built for dev tools, QA,
  and internal use, not the consumer app store.
- **Accessibility coverage gaps.** Games, hardened apps, and some WebView/Canvas surfaces expose a
  partial or empty element tree. A vision fallback (drive from the live frames) is on the roadmap.
- **Audio** is not streamed.

See [`ROADMAP.md`](./ROADMAP.md) for where this is going.

## How the mirror works

The phone captures its screen with `MediaProjection`, encodes to H.264 with the hardware
`MediaCodec` encoder, and serves it over TCP. The PC decodes with the browser-native `VideoDecoder`
(WebCodecs, hardware-accelerated) and paints each frame to a `<canvas>`. Capture is always
whole-screen (Android's consent dialog is forced to "Entire screen"). The APK is built in the cloud
(EAS); see [`beam-android/README.md`](./beam-android/README.md) for the local-toolchain note.

Both apps share one dark theme with an apricot → flashy-blue gradient.
