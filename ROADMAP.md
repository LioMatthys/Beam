# Beam roadmap

Beam's edge is **zero setup**: install an app, enable Accessibility once, connect. Everything below
is filtered through one rule:

> **Nothing may add a step to the core workflow** (install → enable Accessibility → connect → drive).
> New power lives in the agent/host layer or behind optional toggles, never as a required user chore.

Versioning: `1.0.x` for fixes, polish, and additive features that don't change the model. A major
feature (audio, cloud relay, multi-device GA) earns `2.0`.

---

## 0. Security gate (unlocks everything past your own Wi-Fi)

The one hard prerequisite before Beam is anything but LAN-only.

- **TLS on the control + video channels.** Encrypt the wire.
- **Real pairing** (key exchange, not just a 6-digit code), with a remembered trusted-device list.
- *Workflow impact:* none. Pairing already exists; this hardens it invisibly.

## 1. Product

Each item makes Beam more useful **without touching the connect flow.**

- **Recorded flows + replay.** Capture a session (taps, types, asserts) as a named, re-runnable
  script. Turns one-off control into repeatable automation: QA regression, repetitive tasks,
  shareable bug repros (script + video). *Highest leverage.* Lives entirely in the host/agent layer.
- **Assertions + test reports.** Build on `wait_for_text`: add `assert_text` / `assert_visible` and
  emit a pass/fail report with the captured frame attached. This makes Beam a wireless, no-ADB test
  runner for real devices (a Maestro you don't have to wire up).
- **Natural-language task runner.** "Log into the app and screenshot the dashboard." The agent
  plans with `dump` + `tap_text`. The flagship demo; nothing else does it this frictionlessly.
- **Vision fallback.** When `dump` is empty (games, WebViews, custom canvases), let the agent drive
  from the live H.264 frames via OCR + coordinate taps. The mirror becomes the agent's retina when
  the accessibility tree fails. Closes Beam's biggest coverage gap.
- **Multi-device fleet.** One host, many phones, in parallel (QA matrix, fleet ops). Single-device
  use is unchanged; fleet is additive.
- **OTP / 2FA bridge.** Read an incoming SMS code on the phone and hand it to a desktop flow. The
  phone becomes the trusted co-processor for desktop agents. Small, sticky.
- **Approval / audit layer (optional).** A "here's the next action" preview, a step-through mode,
  and a logged action trace. Off by default (so it never slows the agent); on when you want a human
  in the loop or a compliance trail. Trust as a feature.

## 2. Technology optimization

Backend/perf work. None of it is user-visible setup.

- **WebRTC transport.** Replace raw TCP + WebCodecs with WebRTC: NAT traversal, adaptive bitrate,
  lower latency, and audio for free, and a path to a relayed (beyond-LAN) mode without hand-rolling
  TURN. Big unlock, invisible to the user.
- **Cheap `dump`.** Full-tree dumps get large and slow on a hot polling path. Add server-side
  selectors (`query`/`find`), depth caps, and diff-dumps that return only what changed since the
  last call.
- **Robustness for the messy 20%.** Detect a blocked/empty accessibility tree and signal it (so the
  agent can switch to vision), handle screen-off, rotation, and OS-killed service recovery.
- **Observability.** A structured action trace with per-op latency. Feeds the test-report feature
  and makes flaky flows debuggable.
- **Typed protocol, one source of truth.** Generate the TS / Kotlin / Python types from
  `PROTOCOL.md` so the three sides can't drift. Model the connection as an explicit state machine.
- **Battery / thermals.** Tune encoder settings and idle behavior for long sessions on the phone.
- **Distribution.** Signed APK + auto-update, and an MDM/enterprise install path (since Play
  restricts the Accessibility automation use case).

## 3. Already shipped (v1.0)

- 8-op element-driven control (`dump`, `tap_text`, `type_text`, `swipe`, `long_press`,
  `scroll_to_element`, `wait_for_text`, `back`/`home`) + raw `tap`/`screen_size`, all wireless, no ADB.
- Live H.264 screen mirror (hardware encode/decode).
- Stable pairing code + one-click reconnect; keepalive drop-detection; capture starts only on connect.
- DroidPilot (MCP) integration over the Beam control channel.
- Clean architecture pass: business logic in hooks/services, dumb screen components, single source of
  truth for state.
