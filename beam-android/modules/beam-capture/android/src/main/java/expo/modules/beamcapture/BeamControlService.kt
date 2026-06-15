package expo.modules.beamcapture

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * The "hands" and "eyes": an AccessibilityService that performs the control ops the
 * laptop agent sends over the Beam control channel. Ops: screen_size, tap, swipe, back,
 * home, dump (read the on-screen elements), tap_text (find an element by text + tap it).
 * It reads the screen and injects gestures without adb — the only no-root way to do so.
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
      "swipe" -> {
        swipe(
          args.getInt("x1"), args.getInt("y1"),
          args.getInt("x2"), args.getInt("y2"),
          args.optInt("durationMs", 250)
        )
        null
      }
      "back" -> {
        performGlobalAction(GLOBAL_ACTION_BACK)
        null
      }
      "home" -> {
        performGlobalAction(GLOBAL_ACTION_HOME)
        null
      }
      "dump" -> dumpTree()
      "tap_text" -> tapText(args.getString("text"), args.optBoolean("exact", false))
      else -> throw IllegalArgumentException("unsupported op: $op")
    }
  }

  private fun tap(x: Int, y: Int) {
    val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
    val stroke = GestureDescription.StrokeDescription(path, 0L, 50L)
    dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
  }

  private fun swipe(x1: Int, y1: Int, x2: Int, y2: Int, durationMs: Int) {
    val path = Path().apply {
      moveTo(x1.toFloat(), y1.toFloat())
      lineTo(x2.toFloat(), y2.toFloat())
    }
    val stroke = GestureDescription.StrokeDescription(path, 0L, durationMs.toLong().coerceAtLeast(1L))
    dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
  }

  /** Read the on-screen elements (text/desc/bounds/clickable) so the agent can tap by
   *  element instead of guessing pixels. Bounds are physical px, matching tap. */
  private fun dumpTree(): JSONObject {
    val nodes = JSONArray()
    rootInActiveWindow?.let { collectNodes(it, nodes, 0) }
    return JSONObject().put("nodes", nodes)
  }

  private fun collectNodes(node: AccessibilityNodeInfo?, out: JSONArray, depth: Int) {
    if (node == null || out.length() >= 500 || depth > 40) return
    val text = node.text?.toString()
    val desc = node.contentDescription?.toString()
    val clickable = node.isClickable
    if (!text.isNullOrBlank() || !desc.isNullOrBlank() || clickable) {
      val r = Rect()
      node.getBoundsInScreen(r)
      if (r.width() > 0 && r.height() > 0) {
        out.put(JSONObject().apply {
          if (!text.isNullOrBlank()) put("text", text)
          if (!desc.isNullOrBlank()) put("desc", desc)
          put("cls", node.className?.toString() ?: "")
          node.viewIdResourceName?.let { put("id", it) }
          put("clickable", clickable)
          if (node.isScrollable) put("scrollable", true)
          put("bounds", JSONArray().put(r.left).put(r.top).put(r.right).put(r.bottom))
        })
      }
    }
    for (i in 0 until node.childCount) collectNodes(node.getChild(i), out, depth + 1)
  }

  /** Find the first element whose text/description matches and tap its center. */
  private fun tapText(query: String, exact: Boolean): JSONObject {
    val root = rootInActiveWindow ?: throw IllegalStateException("no active window")
    val match = findByText(root, query, exact)
      ?: throw IllegalStateException("text not found: $query")
    val r = Rect()
    match.getBoundsInScreen(r)
    val cx = r.centerX()
    val cy = r.centerY()
    tap(cx, cy)
    return JSONObject().put("tapped", true).put("x", cx).put("y", cy)
  }

  private fun findByText(
    node: AccessibilityNodeInfo?,
    query: String,
    exact: Boolean
  ): AccessibilityNodeInfo? {
    if (node == null) return null
    val candidates = listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
    val hit = candidates.any {
      if (exact) it.equals(query, ignoreCase = true) else it.contains(query, ignoreCase = true)
    }
    if (hit) {
      val r = Rect()
      node.getBoundsInScreen(r)
      if (r.width() > 0 && r.height() > 0) return node
    }
    for (i in 0 until node.childCount) {
      findByText(node.getChild(i), query, exact)?.let { return it }
    }
    return null
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
