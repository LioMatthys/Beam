package expo.modules.beamcapture

/**
 * Lets BeamServer reach the AccessibilityService without a hard dependency: the
 * service registers itself here when the user enables it. If it's null, control
 * is unavailable and HELLO omits the "control" channel (graceful degrade).
 */
object ControlBus {
  @Volatile
  var service: BeamControlService? = null

  val available: Boolean
    get() = service != null
}
