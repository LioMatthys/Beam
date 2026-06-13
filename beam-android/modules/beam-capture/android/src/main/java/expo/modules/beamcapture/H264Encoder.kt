package expo.modules.beamcapture

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Bundle
import android.view.Surface

/**
 * Wraps a hardware H.264 (AVC) encoder fed by a Surface (the screen mirror). Emits
 * encoded Annex-B access units via [onOutput] on a background drain thread.
 *
 * onOutput(bytes, isConfig, isKey): isConfig = SPS/PPS codec-config buffer.
 */
class H264Encoder(
  private val width: Int,
  private val height: Int,
  private val bitrate: Int,
  private val fps: Int,
  private val onOutput: (ByteArray, Boolean, Boolean) -> Unit
) {
  private var codec: MediaCodec? = null
  var inputSurface: Surface? = null
    private set

  @Volatile private var running = false
  private var drainThread: Thread? = null

  /** Codec string derived from the SPS once the config buffer is emitted. */
  @Volatile var codecString: String = "avc1.42E01E"
    private set

  fun start() {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
      setInteger(
        MediaFormat.KEY_BITRATE_MODE,
        MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR
      )
    }

    val c = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    c.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    inputSurface = c.createInputSurface()
    c.start()
    codec = c

    running = true
    drainThread = Thread({ drainLoop() }, "beam-encoder").also { it.start() }
  }

  private fun drainLoop() {
    val c = codec ?: return
    val info = MediaCodec.BufferInfo()
    while (running) {
      val idx = try {
        c.dequeueOutputBuffer(info, 10_000)
      } catch (e: IllegalStateException) {
        break
      }
      if (idx >= 0) {
        val buf = c.getOutputBuffer(idx)
        if (buf != null && info.size > 0) {
          buf.position(info.offset)
          buf.limit(info.offset + info.size)
          val bytes = ByteArray(info.size)
          buf.get(bytes)

          val isConfig = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
          val isKey = (info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0
          if (isConfig) codecString = Protocol.codecStringFromConfig(bytes)
          onOutput(bytes, isConfig, isKey)
        }
        try {
          c.releaseOutputBuffer(idx, false)
        } catch (_: IllegalStateException) {
          break
        }
      }
    }
  }

  /** Ask the encoder to emit a fresh keyframe ASAP (e.g. when a receiver connects). */
  fun requestKeyFrame() {
    try {
      codec?.setParameters(Bundle().apply {
        putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0)
      })
    } catch (_: Exception) {
    }
  }

  fun stop() {
    running = false
    try {
      drainThread?.join(500)
    } catch (_: InterruptedException) {
    }
    try {
      codec?.stop()
    } catch (_: Exception) {
    }
    try {
      codec?.release()
    } catch (_: Exception) {
    }
    try {
      inputSurface?.release()
    } catch (_: Exception) {
    }
    codec = null
    inputSurface = null
  }
}
