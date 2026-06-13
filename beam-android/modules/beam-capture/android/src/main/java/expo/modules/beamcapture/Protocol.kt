package expo.modules.beamcapture

/** Beam wire-protocol constants and helpers. Mirrors ../../PROTOCOL.md. */
object Protocol {
  const val VERSION = 2
  const val DEFAULT_PORT = 8787

  // Channels (multiplexed over the one socket).
  const val CH_VIDEO = 0
  const val CH_CONTROL = 1

  // Channel 0 (video) `type` flag bits.
  const val FLAG_KEYFRAME = 0x01
  const val FLAG_CONFIG = 0x02

  /** Build a 6-byte frame header: [uint32 BE length][uint8 channel][uint8 type]. */
  fun header(length: Int, channel: Int, type: Int): ByteArray {
    return byteArrayOf(
      (length ushr 24).toByte(),
      (length ushr 16).toByte(),
      (length ushr 8).toByte(),
      length.toByte(),
      channel.toByte(),
      type.toByte()
    )
  }

  /**
   * Derive the WebCodecs codec string (e.g. "avc1.640028") from the H.264 SPS
   * inside an Annex-B codec-config buffer: profile_idc, constraint flags, level_idc.
   */
  fun codecStringFromConfig(config: ByteArray): String {
    var i = 0
    while (i + 4 < config.size) {
      val sc4 = config[i].toInt() == 0 && config[i + 1].toInt() == 0 &&
        config[i + 2].toInt() == 0 && config[i + 3].toInt() == 1
      val sc3 = config[i].toInt() == 0 && config[i + 1].toInt() == 0 && config[i + 2].toInt() == 1
      val nalStart = when {
        sc4 -> i + 4
        sc3 -> i + 3
        else -> {
          i++
          continue
        }
      }
      val nalType = config[nalStart].toInt() and 0x1F
      if (nalType == 7 && nalStart + 3 < config.size) {
        val profile = config[nalStart + 1].toInt() and 0xFF
        val constraint = config[nalStart + 2].toInt() and 0xFF
        val level = config[nalStart + 3].toInt() and 0xFF
        return "avc1.%02X%02X%02X".format(profile, constraint, level)
      }
      i = nalStart
    }
    return "avc1.42E01E" // Baseline 3.0 fallback
  }
}
