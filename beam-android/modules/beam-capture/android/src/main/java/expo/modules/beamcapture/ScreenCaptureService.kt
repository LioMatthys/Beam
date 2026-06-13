package expo.modules.beamcapture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Foreground service that owns the live capture pipeline:
 *   MediaProjection → VirtualDisplay → H264Encoder (Surface) → BeamServer (TCP).
 */
class ScreenCaptureService : Service() {
  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var encoder: H264Encoder? = null
  private var server: BeamServer? = null

  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null
  private var receiverRegistered = false

  private val frameCount = AtomicInteger(0)
  private val byteCount = AtomicLong(0)
  private val statsHandler = Handler(Looper.getMainLooper())
  private var lastStatsAt = 0L

  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() {
      teardown()
      stopSelf()
    }
  }

  // When the screen turns on / the user unlocks, push a fresh keyframe (and the
  // cached SPS/PPS) so the receiver resumes instantly instead of showing a frozen
  // frame. The Wi-Fi/CPU wake locks (below) keep the socket alive across the lock.
  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_USER_PRESENT || intent?.action == Intent.ACTION_SCREEN_ON) {
        server?.lastConfig?.let { server?.sendFrame(it, isConfig = true, isKey = false) }
        encoder?.requestKeyFrame()
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      teardown()
      stopSelf()
      return START_NOT_STICKY
    }

    val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
    @Suppress("DEPRECATION")
    val data: Intent? = intent?.getParcelableExtra(EXTRA_DATA)
    @Suppress("DEPRECATION")
    val params: CaptureParams? = intent?.getParcelableExtra(EXTRA_PARAMS)
    if (data == null || params == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForegroundNotification()

    try {
      startPipeline(resultCode, data, params)
    } catch (e: Exception) {
      BeamBus.error(e.message ?: "capture failed")
      teardown()
      stopSelf()
      return START_NOT_STICKY
    }

    acquireWakeLocks()
    registerScreenReceiver()

    isRunning = true
    BeamBus.status("waiting", 0)
    return START_NOT_STICKY
  }

  /** Keep CPU + Wi-Fi alive while sharing so the socket survives a screen lock. */
  private fun acquireWakeLocks() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "beam:capture").apply {
        setReferenceCounted(false)
        acquire()
      }
      val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        WifiManager.WIFI_MODE_FULL_LOW_LATENCY
      } else {
        @Suppress("DEPRECATION")
        WifiManager.WIFI_MODE_FULL_HIGH_PERF
      }
      wifiLock = wm.createWifiLock(mode, "beam:wifi").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Exception) {
      // Locks are best-effort; capture still works without them.
    }
  }

  private fun registerScreenReceiver() {
    if (receiverRegistered) return
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_USER_PRESENT)
      addAction(Intent.ACTION_SCREEN_ON)
    }
    registerReceiver(screenReceiver, filter)
    receiverRegistered = true
  }

  private fun startPipeline(resultCode: Int, data: Intent, params: CaptureParams) {
    val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val mp = mpm.getMediaProjection(resultCode, data)
      ?: throw IllegalStateException("MediaProjection unavailable")
    projection = mp
    mp.registerCallback(projectionCallback, Handler(Looper.getMainLooper()))

    val enc = H264Encoder(params.width, params.height, params.bitrate, params.fps) { bytes, isConfig, isKey ->
      frameCount.incrementAndGet()
      byteCount.addAndGet(bytes.size.toLong())
      server?.sendFrame(bytes, isConfig, isKey)
    }
    enc.start()
    encoder = enc

    val srv = BeamServer(
      port = params.port,
      code = params.code,
      deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim(),
      width = params.width,
      height = params.height,
      fps = params.fps,
      codecProvider = { enc.codecString },
      onClientChange = { count -> BeamBus.status(if (count > 0) "streaming" else "waiting", count) },
      onError = { msg -> BeamBus.error(msg) },
      onClientReady = {
        srvLastConfigResend()
        enc.requestKeyFrame()
      }
    )
    srv.start()
    server = srv

    val dpi = resources.displayMetrics.densityDpi
    virtualDisplay = mp.createVirtualDisplay(
      "beam",
      params.width,
      params.height,
      dpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      enc.inputSurface,
      null,
      null
    )

    lastStatsAt = SystemClock.elapsedRealtime()
    statsHandler.postDelayed(statsTick, 1000)
  }

  /** Re-send the cached SPS/PPS so a freshly connected receiver can configure. */
  private fun srvLastConfigResend() {
    val cfg = server?.lastConfig ?: return
    server?.sendFrame(cfg, isConfig = true, isKey = false)
  }

  private val statsTick = object : Runnable {
    override fun run() {
      val now = SystemClock.elapsedRealtime()
      val dt = (now - lastStatsAt).coerceAtLeast(1)
      val frames = frameCount.getAndSet(0)
      val bytes = byteCount.getAndSet(0)
      lastStatsAt = now
      val fps = (frames * 1000 / dt).toInt()
      val kbps = (bytes * 8 / dt).toInt() // bytes*8 per ms == kbits per s
      if (server?.hasClient() == true) BeamBus.stats(fps, kbps)
      statsHandler.postDelayed(this, 1000)
    }
  }

  private fun startForegroundNotification() {
    val channelId = "beam_capture"
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, "Beam", NotificationManager.IMPORTANCE_LOW)
      nm.createNotificationChannel(channel)
    }
    val notification: Notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle("Beam")
      .setContentText("Partage de l'écran en cours")
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun teardown() {
    statsHandler.removeCallbacksAndMessages(null)
    if (receiverRegistered) {
      try {
        unregisterReceiver(screenReceiver)
      } catch (_: Exception) {
      }
      receiverRegistered = false
    }
    try {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    } catch (_: Exception) {
    }
    try {
      if (wifiLock?.isHeld == true) wifiLock?.release()
    } catch (_: Exception) {
    }
    wakeLock = null
    wifiLock = null
    try {
      server?.stop()
    } catch (_: Exception) {
    }
    try {
      virtualDisplay?.release()
    } catch (_: Exception) {
    }
    try {
      encoder?.stop()
    } catch (_: Exception) {
    }
    try {
      projection?.unregisterCallback(projectionCallback)
      projection?.stop()
    } catch (_: Exception) {
    }
    server = null
    virtualDisplay = null
    encoder = null
    projection = null
    isRunning = false
    BeamBus.status("idle", 0)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  override fun onDestroy() {
    teardown()
    super.onDestroy()
  }

  companion object {
    @Volatile
    var isRunning = false
      private set

    private const val NOTIF_ID = 4242
    private const val ACTION_STOP = "expo.modules.beamcapture.STOP"
    private const val EXTRA_RESULT_CODE = "resultCode"
    private const val EXTRA_DATA = "data"
    private const val EXTRA_PARAMS = "params"

    fun start(context: Context, resultCode: Int, data: Intent, params: CaptureParams) {
      val intent = Intent(context, ScreenCaptureService::class.java).apply {
        putExtra(EXTRA_RESULT_CODE, resultCode)
        putExtra(EXTRA_DATA, data)
        putExtra(EXTRA_PARAMS, params)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      val intent = Intent(context, ScreenCaptureService::class.java).apply { action = ACTION_STOP }
      context.startService(intent)
    }
  }
}
