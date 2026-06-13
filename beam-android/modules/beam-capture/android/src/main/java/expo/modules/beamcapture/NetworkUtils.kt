package expo.modules.beamcapture

import java.net.Inet4Address
import java.net.NetworkInterface

object NetworkUtils {
  /**
   * Returns the device's current IPv4 LAN address (Wi-Fi or hotspot), or "" if
   * none. Skips loopback and down interfaces; prefers site-local addresses.
   */
  fun getWifiIp(): String {
    try {
      val interfaces = NetworkInterface.getNetworkInterfaces() ?: return ""
      for (nif in interfaces) {
        if (!nif.isUp || nif.isLoopback) continue
        val name = nif.name.lowercase()
        // Skip obvious virtual/cellular-only interfaces where possible.
        if (name.startsWith("rmnet")) continue
        for (addr in nif.inetAddresses) {
          if (addr is Inet4Address && !addr.isLoopbackAddress && addr.isSiteLocalAddress) {
            return addr.hostAddress ?: ""
          }
        }
      }
    } catch (_: Exception) {
      // fall through
    }
    return ""
  }
}
