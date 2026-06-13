package expo.modules.beamcapture

import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.max

class BeamCaptureModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No app context")

  private var pendingPromise: Promise? = null
  private var pendingParams: CaptureParams? = null

  override fun definition() = ModuleDefinition {
    Name("BeamCapture")

    Events("onStatus", "onStats", "onError")

    Function("getIpAddress") { NetworkUtils.getWifiIp() }

    Function("isRunning") { ScreenCaptureService.isRunning }

    AsyncFunction("start") { config: Map<String, Any?>, promise: Promise ->
      startCapture(config, promise)
    }

    AsyncFunction("stop") { promise: Promise ->
      ScreenCaptureService.stop(context.applicationContext)
      promise.resolve(null)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQ_PROJECTION) return@OnActivityResult
      val promise = pendingPromise
      val params = pendingParams
      pendingPromise = null
      pendingParams = null
      if (promise == null || params == null) return@OnActivityResult

      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null) {
        BeamBus.status("idle", 0)
        promise.reject("E_PERMISSION_DENIED", "Screen capture permission denied", null)
        return@OnActivityResult
      }

      ScreenCaptureService.start(context.applicationContext, payload.resultCode, data, params)
      promise.resolve(
        mapOf(
          "ip" to NetworkUtils.getWifiIp(),
          "port" to params.port,
          "code" to params.code,
          "width" to params.width,
          "height" to params.height
        )
      )
    }

    OnCreate {
      BeamBus.onStatus = { state, clients ->
        sendEvent("onStatus", mapOf("state" to state, "clients" to clients))
      }
      BeamBus.onStats = { fps, kbps ->
        sendEvent("onStats", mapOf("fps" to fps, "kbps" to kbps))
      }
      BeamBus.onError = { message ->
        sendEvent("onError", mapOf("message" to message))
      }
    }

    OnDestroy {
      BeamBus.clear()
    }
  }

  private fun startCapture(config: Map<String, Any?>, promise: Promise) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No current activity", null)
      return
    }

    val params = computeParams(config)
    pendingParams = params
    pendingPromise = promise

    val mpm = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    activity.startActivityForResult(mpm.createScreenCaptureIntent(), REQ_PROJECTION)
  }

  private fun computeParams(config: Map<String, Any?>): CaptureParams {
    val maxSize = (config["maxSize"] as? Number)?.toInt() ?: 0
    val bitrateMbps = (config["bitrateMbps"] as? Number)?.toInt() ?: 8
    val fps = (config["fps"] as? Number)?.toInt() ?: 60

    val (sw, sh) = screenSize()
    var w = sw
    var h = sh
    if (maxSize > 0) {
      val longEdge = max(w, h)
      if (longEdge > maxSize) {
        val scale = maxSize.toFloat() / longEdge
        w = (w * scale).toInt()
        h = (h * scale).toInt()
      }
    }
    // Encoders require even dimensions.
    w = w and 1.inv()
    h = h and 1.inv()

    val code = (100000..999999).random().toString()
    return CaptureParams(
      width = w.coerceAtLeast(2),
      height = h.coerceAtLeast(2),
      bitrate = bitrateMbps * 1_000_000,
      fps = fps,
      port = Protocol.DEFAULT_PORT,
      code = code,
      physWidth = sw,
      physHeight = sh,
      rotation = displayRotation()
    )
  }

  private fun displayRotation(): Int {
    return try {
      val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        context.display?.rotation ?: 0
      } else {
        @Suppress("DEPRECATION")
        wm.defaultDisplay.rotation
      }
    } catch (_: Exception) {
      0
    }
  }

  private fun screenSize(): Pair<Int, Int> {
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bounds = wm.currentWindowMetrics.bounds
      Pair(bounds.width(), bounds.height())
    } else {
      val dm = DisplayMetrics()
      @Suppress("DEPRECATION")
      wm.defaultDisplay.getRealMetrics(dm)
      Pair(dm.widthPixels, dm.heightPixels)
    }
  }

  companion object {
    private const val REQ_PROJECTION = 0x3EE7
  }
}
