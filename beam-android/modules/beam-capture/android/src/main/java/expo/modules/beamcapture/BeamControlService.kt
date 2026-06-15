package expo.modules.beamcapture

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Base64
import android.util.DisplayMetrics
import android.view.Display
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

/**
 * The "hands" and "eyes": an AccessibilityService that performs the control ops the
 * laptop agent sends over the Beam control channel. Ops: screen_size, tap, swipe, back,
 * home, dump (read the on-screen elements), tap_text, type_text, long_press,
 * scroll_to_element, wait_for_text. It reads the screen and injects gestures/text
 * without adb — the only no-root way to do so.
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
      "type_text" -> {
        typeText(args.getString("text"))
        null
      }
      "long_press" -> {
        longPress(args.getInt("x"), args.getInt("y"), args.optInt("durationMs", 500))
        null
      }
      "scroll_to_element" -> scrollToElement(args.getString("text"), args.optBoolean("exact", false))
      "wait_for_text" -> waitForText(args.getString("text"), args.optBoolean("exact", false), args.optInt("timeoutMs", 5000))
      "screenshot" -> screenshot(args.optInt("maxLongSide", 1280))
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
          if (node.isSelected) put("selected", true)
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

  /** Set text on the currently focused editable field (replaces its contents). */
  private fun typeText(text: String) {
    val focused = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
    if (focused == null || !focused.isEditable) {
      throw IllegalStateException("no focused editable field to type into")
    }
    val args = Bundle().apply {
      putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
    }
    val ok = focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    if (!ok) throw IllegalStateException("set-text action was rejected by the field")
  }

  /** Hold down a touch at (x,y) for the given duration. */
  private fun longPress(x: Int, y: Int, durationMs: Int) {
    val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
    val stroke = GestureDescription.StrokeDescription(path, 0L, durationMs.toLong().coerceAtLeast(1L))
    dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
  }

  /** Find an element by text and scroll into view. Returns bounds if found, or error. */
  private fun scrollToElement(query: String, exact: Boolean): JSONObject {
    val root = rootInActiveWindow ?: throw IllegalStateException("no active window")
    var node = findByText(root, query, exact)
    var attempts = 0
    while (node == null && attempts < 5) {
      // Scroll down to try to reveal the element.
      val (_, h) = realSize()
      swipe(540, h / 2, 540, h / 2 - 300, 400)
      Thread.sleep(300)
      node = findByText(rootInActiveWindow, query, exact)
      attempts++
    }
    if (node == null) throw IllegalStateException("element not found after scrolling: $query")
    val r = Rect()
    node.getBoundsInScreen(r)
    return JSONObject()
      .put("found", true)
      .put("bounds", JSONArray().put(r.left).put(r.top).put(r.right).put(r.bottom))
  }

  /** Poll until the given text appears on screen (or timeout). */
  private fun waitForText(query: String, exact: Boolean, timeoutMs: Int): JSONObject {
    val deadline = SystemClock.elapsedRealtime() + timeoutMs
    while (SystemClock.elapsedRealtime() < deadline) {
      val root = rootInActiveWindow
      if (root != null && findByText(root, query, exact) != null) {
        return JSONObject().put("found", true)
      }
      Thread.sleep(200)
    }
    throw IllegalStateException("text did not appear within ${timeoutMs}ms: $query")
  }

  /** Capture the screen via the AccessibilityService screenshot API (no MediaProjection).
   *  Returns a base64 PNG so a vision agent can "see" when the element tree is empty
   *  (games, WebViews, custom canvases). Downscaled to maxLongSide to bound payload size. */
  private fun screenshot(maxLongSide: Int): JSONObject {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      throw IllegalStateException("screenshot requires Android 11+")
    }
    val latch = CountDownLatch(1)
    var png: String? = null
    var failure: String? = null
    takeScreenshot(
      Display.DEFAULT_DISPLAY,
      mainExecutor,
      object : TakeScreenshotCallback {
        override fun onSuccess(result: ScreenshotResult) {
          try {
            val buffer = result.hardwareBuffer
            val hw = Bitmap.wrapHardwareBuffer(buffer, result.colorSpace)
            buffer.close()
            if (hw == null) {
              failure = "could not decode screenshot buffer"
            } else {
              // Hardware bitmaps are immutable; copy to software, then optionally downscale.
              val soft = hw.copy(Bitmap.Config.ARGB_8888, false)
              hw.recycle()
              val scaled = downscale(soft, maxLongSide)
              val baos = ByteArrayOutputStream()
              scaled.compress(Bitmap.CompressFormat.PNG, 100, baos)
              if (scaled !== soft) soft.recycle()
              png = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            }
          } catch (e: Exception) {
            failure = e.message ?: "screenshot conversion failed"
          } finally {
            latch.countDown()
          }
        }

        override fun onFailure(errorCode: Int) {
          failure = "screenshot failed (code $errorCode)"
          latch.countDown()
        }
      }
    )
    if (!latch.await(5, TimeUnit.SECONDS)) throw IllegalStateException("screenshot timed out")
    failure?.let { throw IllegalStateException(it) }
    return JSONObject().put("png", png)
  }

  private fun downscale(bmp: Bitmap, maxLongSide: Int): Bitmap {
    val longSide = maxOf(bmp.width, bmp.height)
    if (maxLongSide <= 0 || longSide <= maxLongSide) return bmp
    val ratio = maxLongSide.toFloat() / longSide
    return Bitmap.createScaledBitmap(bmp, (bmp.width * ratio).toInt(), (bmp.height * ratio).toInt(), true)
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
