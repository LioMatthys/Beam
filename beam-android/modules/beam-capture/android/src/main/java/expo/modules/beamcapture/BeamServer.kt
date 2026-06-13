package expo.modules.beamcapture

import org.json.JSONObject
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket

/**
 * TCP server: accepts one receiver (the PC), performs the HELLO + pairing-code
 * handshake, then writes length-prefixed H.264 frames. Single-client in v1.
 */
class BeamServer(
  private val port: Int,
  private val code: String,
  private val deviceName: String,
  private val width: Int,
  private val height: Int,
  private val fps: Int,
  private val codecProvider: () -> String,
  private val onClientChange: (Int) -> Unit,
  private val onError: (String) -> Unit,
  private val onClientReady: () -> Unit
) {
  private var serverSocket: ServerSocket? = null
  private var client: Socket? = null
  private var out: OutputStream? = null
  private val writeLock = Any()
  @Volatile private var running = false
  private var acceptThread: Thread? = null

  /** Most recent SPS/PPS, re-sent to each new client before requesting a keyframe. */
  @Volatile var lastConfig: ByteArray? = null

  fun start() {
    running = true
    serverSocket = ServerSocket(port)
    acceptThread = Thread({ acceptLoop() }, "beam-accept").also { it.start() }
  }

  private fun acceptLoop() {
    while (running) {
      try {
        val socket = serverSocket?.accept() ?: break
        socket.tcpNoDelay = true
        handleClient(socket)
      } catch (e: Exception) {
        if (running) onError("accept: ${e.message}")
      }
    }
  }

  private fun handleClient(socket: Socket) {
    try {
      val os = socket.getOutputStream()
      val hello = JSONObject().apply {
        put("beam", Protocol.VERSION)
        put("device", deviceName)
        put("width", width)
        put("height", height)
        put("fps", fps)
        put("codec", codecProvider())
      }.toString()
      os.write((hello + "\n").toByteArray(Charsets.UTF_8))
      os.flush()

      val line = socket.getInputStream().bufferedReader().readLine()
      if (line == null || line.trim() != code) {
        onError("pairing rejected")
        socket.close()
        return
      }

      synchronized(writeLock) {
        try {
          client?.close()
        } catch (_: Exception) {
        }
        client = socket
        out = os
      }
      onClientChange(1)
      onClientReady()
    } catch (e: Exception) {
      onError("client: ${e.message}")
      try {
        socket.close()
      } catch (_: Exception) {
      }
    }
  }

  /** Write one frame to the connected client (no-op if none). */
  fun sendFrame(data: ByteArray, isConfig: Boolean, isKey: Boolean) {
    if (isConfig) lastConfig = data
    val o = out ?: return
    val flags = (if (isKey) Protocol.FLAG_KEYFRAME else 0) or (if (isConfig) Protocol.FLAG_CONFIG else 0)
    try {
      synchronized(writeLock) {
        o.write(Protocol.header(data.size, flags))
        o.write(data)
        o.flush()
      }
    } catch (e: Exception) {
      synchronized(writeLock) {
        try {
          client?.close()
        } catch (_: Exception) {
        }
        client = null
        out = null
      }
      onClientChange(0)
    }
  }

  fun hasClient(): Boolean = out != null

  fun stop() {
    running = false
    synchronized(writeLock) {
      try {
        client?.close()
      } catch (_: Exception) {
      }
      client = null
      out = null
    }
    try {
      serverSocket?.close()
    } catch (_: Exception) {
    }
    try {
      acceptThread?.join(500)
    } catch (_: InterruptedException) {
    }
  }
}
