package expo.modules.beamcapture

/**
 * Tiny event bridge between the foreground service (which has no JS access) and
 * the module (which forwards to JS). The module sets these callbacks in OnCreate
 * and clears them in OnDestroy.
 */
object BeamBus {
  @Volatile var onStatus: ((state: String, clients: Int) -> Unit)? = null
  @Volatile var onStats: ((fps: Int, kbps: Int) -> Unit)? = null
  @Volatile var onError: ((message: String) -> Unit)? = null

  fun status(state: String, clients: Int) = onStatus?.invoke(state, clients)
  fun stats(fps: Int, kbps: Int) = onStats?.invoke(fps, kbps)
  fun error(message: String) = onError?.invoke(message)

  fun clear() {
    onStatus = null
    onStats = null
    onError = null
  }
}
