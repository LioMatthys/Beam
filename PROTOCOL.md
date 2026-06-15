# Beam wire protocol — v2

Single source of truth for how the phone and the PC talk. `beam-android`,
`beam-windows`, and DroidPilot's `BeamTransport` must all agree on this.

v2 turns the single connection into a **multiplexed link**: the same socket now
carries several logical **channels** (video, control, and room for more), each frame
tagged with a channel id. v1 carried only video; v2 channel 0 *is* that video stream,
so the change is one extra header byte plus a demux.

## Transport

- **TCP** over the local network (same Wi-Fi). No cable; discovery via mDNS (below).
- The **phone is the socket server** (`ServerSocket`), the **PC is the socket client**.
  (Socket role and who-initiates-a-channel are independent — see Control.)
- Default port: **8787**.
- All multi-byte integers are **big-endian**.
- One connection = one session. Closing the socket ends the session.

## Discovery (mDNS / DNS-SD)

The phone advertises the service type **`_beam._tcp`** on port 8787 via Android NSD,
with TXT records: `v=2`, `device=<model>`, `code=<sha256(pairingCode)[:8] hex>` (a
non-reversible hint so the PC can pre-match the displayed code, never the code itself).
The PC browses `_beam._tcp`, resolves IP+port, and connects — no IP typed. Manual IP
entry and the QR/relay path remain as fallbacks for AP-isolated / cellular networks.

## Connection lifecycle

```
PC (socket client)                         Phone (socket server)
 |  --- TCP connect ----------------------> |
 |  <-- HELLO (1 JSON line + \n) ----------- |
 |  --- CODE (6 digits + \n) --------------> |   validates; closes on mismatch
 |  <-- [ch0 config frame] ----------------- |   (video SPS/PPS)
 |  <-- [ch0 keyframe frame] --------------- |
 |  <-- [ch0 delta] ... -------------------- |   (continuous video)
 |  --- [ch1 control request] -------------> |   {"id":1,"op":"screen_size"}
 |  <-- [ch1 control response] ------------- |   {"id":1,"ok":true,"result":{...}}
 |  --- [ch1 control request] -------------> |   {"id":2,"op":"tap","args":{"x":..,"y":..}}
 |  <-- [ch1 control response] ------------- |   {"id":2,"ok":true,"result":null}
```

After the handshake the socket is **bidirectional and framed**: the phone writes video
(ch0) and control responses (ch1); the PC writes control requests (ch1).

## Framing (all channels)

```
+--------------+-----------+--------+------------------------+
| length (u32) | channel   | type   | payload (length bytes) |
+--------------+-----------+--------+------------------------+
   4 bytes       1 byte      1 byte    channel-specific
```

- `length` — bytes in `payload` only (does **not** include the 6-byte header).
- `channel` — `0` = VIDEO, `1` = CONTROL, `2..255` reserved (input, files, clipboard, logs).
- `type` — channel-specific (below).

### Channel 0 — VIDEO

- `type` = flag bitfield: bit0 `0x01` keyframe (IDR), bit1 `0x02` codec-config (SPS/PPS).
- `payload` = H.264 **Annex-B** bytes. Ordering/decoding unchanged from v1: first frame
  is config, then a keyframe, then deltas; drop until the first keyframe; decode with
  WebCodecs feeding the cached config prepended to each keyframe.

### Channel 1 — CONTROL

- `type` = `0` (JSON message). Other types reserved.
- `payload` = one UTF-8 JSON object (no trailing newline).
- **Request** (PC → phone): `{"id":<int>,"op":"<name>","args":{...}}`
- **Response** (phone → PC): `{"id":<int>,"ok":true,"result":<any>}`
  or `{"id":<int>,"ok":false,"error":"<message>"}`
- `id` is a monotonic per-session integer chosen by the PC; the phone echoes it.

#### Control ops

The op names match DroidPilot's tool surface so the laptop agent maps 1:1.

| op | args | result |
|---|---|---|
| `screen_size` | — | `{"width":W,"height":H}` (physical px) |
| `tap` | `{"x":int,"y":int}` | `null` |
| `swipe` | `{"x1","y1","x2","y2","durationMs"?}` | `null` |
| `long_press` | `{"x":int,"y":int,"durationMs"?}` | `null` |
| `back` / `home` | — | `null` (global navigation) |
| `dump` | — | `{"nodes":[{"text"?,"desc"?,"cls","id"?,"clickable","scrollable"?,"selected"?,"bounds":[l,t,r,b]}, …]}` — visible elements; `bounds` in physical px |
| `tap_text` | `{"text":str,"exact"?:bool}` | `{"tapped":true,"x":"y"}` |
| `type_text` | `{"text":str}` | `null` — inject text into the focused input field |
| `scroll_to_element` | `{"text":str,"exact"?:bool}` | `{"found":true,"bounds":[l,t,r,b]}` — find + scroll into view |
| `wait_for_text` | `{"text":str,"exact"?:bool,"timeoutMs"?}` | `{"found":true}` — poll until text appears (or timeout) |
| `screenshot` | `{"maxLongSide"?:int}` | `{"png":"<base64>"}` — captured via the AccessibilityService screenshot API (Android 11+), downscaled to `maxLongSide`. The **vision fallback** for when the element tree is empty (games, WebViews, canvases). |

These ops enable **full element-driven automation**: read, navigate, fill, interact, and *see*
(vision fallback), all over wireless, no adb.

**Coordinates are physical device pixels** (`0..physWidth`, `0..physHeight`). The PC maps
a canvas/video click → physical px using HELLO's `physWidth/physHeight/rotation` before
sending `tap`.

## HELLO (phone → PC)

```json
{"beam":2,"device":"Pixel 7","width":1080,"height":2400,
 "physWidth":1080,"physHeight":2400,"rotation":0,
 "fps":60,"codec":"avc1.640028","channels":["video","control"]}
```

| field | meaning |
|---|---|
| `beam` | protocol version, must be `2` |
| `width`/`height` | encoded video dimensions |
| `physWidth`/`physHeight`/`rotation` | physical display, for mapping control taps |
| `codec` | WebCodecs codec string |
| `channels` | which channels this phone supports this session. Always includes `"video"`. Includes `"control"` **only when the AccessibilityService is enabled & bound.** |

The PC rejects/closes if `beam !== 2` or `codec` is missing. If `channels` lacks
`"control"`, the PC runs **eyes-only** (cast works, no control) — graceful degrade for
devices where accessibility is off/revoked (e.g. Advanced Protection Mode).

## Reconnection

- Socket drop → PC retries with backoff (250 ms → 4 s).
- On reconnect the phone re-sends video config + keyframe; the PC replays any in-flight
  control request whose response was lost (ids are monotonic; ops idempotent by default).
- *(v1 of control adds a session token in a `hello-ack` so reconnects skip the 6-digit code.)*

## Security note

The pairing code is a friendliness/safety check, **not** encryption — v2 traffic is
plaintext on the LAN. The CONTROL channel injects input and reads the UI tree, i.e.
remote control of the phone, so it is **LAN-only** and gated by a per-session on-phone
consent toggle. **TLS + stronger pairing is a hard gate before CONTROL ever leaves a
trusted LAN or rides a cloud relay.**
