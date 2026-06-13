package expo.modules.beamcapture

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject

/**
 * The "hands": an AccessibilityService that performs the control ops the laptop
 * agent sends over the Beam control channel. MVP ops: screen_size, tap. It reads
 * the screen and injects gestures without adb — the only no-root way to do so.
 *
 * Enabled once by the user in Settings > Accessibility. While enabled it registers
 * in ControlBus so BeamServer can dispatch ops to it.
 */
class BeamControlService : AccessibilityService() {
  override fun onServiceConnected() {
    super.onServiceConnected()
    ControlBus.service = this
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
  override fun onInterrupt() {}

  override fun onUnbind(intent: Intent?): Boolean {
    ControlBus.service = null
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    ControlBus.service = null
    super.onDestroy()
  }

  /** Run a control op. Returns a JSON-serializable result (or null). Throws on error. */
  fun execute(op: String, args: JSONObject): Any? {
    return when (op) {
      "screen_size" -> {
        val (w, h) = realSize()
        JSONObject().put("width", w).put("height", h)
      }
      "tap" -> {
        tap(args.getInt("x"), args.getInt("y"))
        null
      }
      else -> throw IllegalArgumentException("unsupported op: $op")
    }
  }

  private fun tap(x: Int, y: Int) {
    val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
    val stroke = GestureDescription.StrokeDescription(path, 0L, 50L)
    dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
  }

  private fun realSize(): Pair<Int, Int> {
    val wm = getSystemService(WINDOW_SERVICE) as WindowManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val b = wm.currentWindowMetrics.bounds
      Pair(b.width(), b.height())
    } else {
      val dm = DisplayMetrics()
      @Suppress("DEPRECATION")
      wm.defaultDisplay.getRealMetrics(dm)
      Pair(dm.widthPixels, dm.heightPixels)
    }
  }
}
