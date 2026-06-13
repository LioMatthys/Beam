# Beam wire protocol — v1

Single source of truth for how the phone (sender) talks to the PC (receiver).
Both `beam-android` and `beam-windows` must agree on everything here.

## Transport

- **TCP** over the local network (same Wi-Fi).
- The **phone is the server** (`ServerSocket`), the **PC is the client**.
- Default port: **8787**.
- All multi-byte integers are **big-endian** (network byte order).
- One connection = one mirroring session. Closing the socket ends the session.

## Connection lifecycle

```
PC                                  Phone
 |                                    |  (user taps "Start", phone listens on :8787)
 |  --- TCP connect ----------------> |
 |  <-- HELLO (1 JSON line + \n) ---- |
 |  --- CODE (6 digits + \n) -------> |
 |                                    |  validates code; closes on mismatch
 |  <-- [config frame] ------------- |   (SPS/PPS)
 |  <-- [keyframe frame] ----------- |
 |  <-- [delta frame] -------------- |
 |  <-- [delta frame] -------------- |
 |  ...                               |
```

### 1. HELLO (phone → PC)

A single UTF-8 JSON object terminated by `\n`:

```json
{"beam":1,"device":"Pixel 7","width":1080,"height":2400,"fps":60,"codec":"avc1.640028"}
```

| field    | type   | meaning                                                        |
|----------|--------|----------------------------------------------------------------|
| `beam`   | int    | protocol version. Must be `1`.                                 |
| `device` | string | human-readable device name, shown in the PC UI.                |
| `width`  | int    | encoded video width in pixels.                                 |
| `height` | int    | encoded video height in pixels.                                |
| `fps`    | int    | target frames per second.                                      |
| `codec`  | string | WebCodecs codec string derived from SPS (e.g. `avc1.640028`).  |

The PC must reject (and close) if `beam !== 1` or `codec` is missing.

### 2. CODE (PC → phone)

The 6-digit pairing code the phone is displaying, as ASCII digits + `\n`
(e.g. `"482915\n"`). The phone closes the socket immediately on mismatch.
This is a friendliness/safety check, not strong security (see Security note).

### 3. Video frames (phone → PC)

After pairing, the phone sends a continuous sequence of length-prefixed frames:

```
+--------------+--------+------------------------+
| length (u32) | flags  | payload (length bytes) |
+--------------+--------+------------------------+
   4 bytes       1 byte    H.264 Annex-B bytes
```

- `length` — number of bytes in `payload` (does **not** include the 5-byte header).
- `flags` — bitfield:
  - bit 0 (`0x01`) — **keyframe** (IDR). Payload is a decodable key chunk.
  - bit 1 (`0x02`) — **codec config**. Payload is SPS+PPS (Annex-B). Sent once up front
    and again on reconfiguration. Carries no displayable picture.
  - other bits reserved, must be 0.
- `payload` — raw H.264 **Annex-B** bytes (start codes `00 00 00 01` included).

Frame ordering guarantees:
1. The **first** frame after pairing has `flags & 0x02` (config).
2. The next frame is a keyframe (`flags & 0x01`).
3. Thereafter, deltas, with periodic keyframes (encoder may request IDR on demand).

## Receiver decode rules (WebCodecs)

- Configure `VideoDecoder` with `{ codec: <hello.codec>, optimizeForLatency: true }`.
  The Annex-B config frame is fed as the first `EncodedVideoChunk` of type `"key"` is
  **not** required; instead pass SPS/PPS via `description` OR feed the config bytes
  prepended to the first keyframe. Implementation: prepend the most recent config
  payload to the next keyframe payload, then submit one `"key"` chunk. (Annex-B inline
  SPS/PPS is accepted by Chromium's decoder.)
- Drop everything until the first keyframe arrives (deltas before it are undecodable).
- Timestamps: monotonic microsecond counter, `1_000_000 / fps` increment per frame.

## Reconnection

- If the socket drops, the PC retries connect with backoff (250 ms → 4 s).
- On reconnect the phone re-sends config + keyframe first, so playback self-heals.

## Security note (v1)

The pairing code prevents accidental connections on a shared LAN; it is **not**
encryption. v1 traffic is plaintext on the local network. TLS / stronger pairing is a
future addition and is out of scope for v1.
