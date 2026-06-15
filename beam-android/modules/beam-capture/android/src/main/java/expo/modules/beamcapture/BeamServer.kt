package expo.modules.beamcapture

import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket

/**
 * TCP server for one receiver (the PC). Performs HELLO v2 + pairing, then runs a
 * multiplexed link: writes video on channel 0, and reads CONTROL requests (channel 1)
 * from the PC — dispatching them to the AccessibilityService and replying on channel 1.
 * Single client in the MVP. See ../../PROTOCOL.md.
 */
class BeamServer(
  private val port: Int,
  private val code: String,
  private val deviceName: String,
  private val width: Int,
  private val height: Int,
  private val physWidth: Int,
  private val physHeight: Int,
  private val rotation: Int,
  private val fps: Int,
  private val codecProvider: () -> String,
  private val onClientChange: (Int) -> Unit,
  private val onClientConnected: (String) -> Unit,
  private val onError: (String) -> Unit,
  private val onClientReady: () -> Unit
) {
  private var serverSocket: ServerSocket? = null
  private var client: Socket? = null
  private var out: OutputStream? = null
  private val writeLock = Any()
  @Volatile private var running = false
  private var acceptThread: Thread? = null

  /** Most recent SPS/PPS, re-sent to each new client before the keyframe. */
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
        handleClient(socket) // blocks until this client disconnects (single client)
      } catch (e: Exception) {
        if (running) onError("accept: ${e.message}")
      }
    }
  }

  private fun handleClient(socket: Socket) {
    try {
      val os = socket.getOutputStream()
      val input = socket.getInputStream()

      val channels = JSONArray().put("video")
      if (ControlBus.available) channels.put("control")
      val hello = JSONObject().apply {
        put("beam", Protocol.VERSION)
        put("device", deviceName)
        put("width", width)
        put("height", height)
        put("physWidth", physWidth)
        put("physHeight", physHeight)
        put("rotation", rotation)
        put("fps", fps)
        put("codec", codecProvider())
        put("channels", channels)
      }.toString()
      os.write((hello + "\n").toByteArray(Charsets.UTF_8))
      os.flush()

      val line = readPlainLine(input)
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
      onClientConnected(socket.inetAddress?.hostAddress ?: "")
      onClientReady()

      controlReadLoop(input) // returns when the client disconnects
    } catch (e: Exception) {
      onError("client: ${e.message}")
      try {
        socket.close()
      } catch (_: Exception) {
      }
    } finally {
      synchronized(writeLock) {
        if (client === socket) {
          client = null
          out = null
        }
      }
      onClientChange(0)
    }
  }

  /** Read the pairing-code line without buffering ahead into the frame stream. */
  private fun readPlainLine(input: InputStream): String? {
    val sb = StringBuilder()
    while (true) {
      val b = input.read()
      if (b < 0) return if (sb.isEmpty()) null else sb.toString()
      if (b == 0x0a) return sb.toString()
      if (b != 0x0d) sb.append(b.toChar())
      if (sb.length > 64) return sb.toString()
    }
  }

  private fun controlReadLoop(input: InputStream) {
    val header = ByteArray(6)
    while (running && client != null) {
      if (!readFully(input, header, 6)) break
      val len = ((header[0].toInt() and 0xFF) shl 24) or
        ((header[1].toInt() and 0xFF) shl 16) or
        ((header[2].toInt() and 0xFF) shl 8) or
        (header[3].toInt() and 0xFF)
      val channel = header[4].toInt() and 0xFF
      val payload = ByteArray(len)
      if (len > 0 && !readFully(input, payload, len)) break
      if (channel == Protocol.CH_CONTROL) {
        handleControl(String(payload, Charsets.UTF_8))
      }
      // other channels ignored inbound for now
    }
  }

  private fun readFully(input: InputStream, buf: ByteArray, n: Int): Boolean {
    var off = 0
    while (off < n) {
      val r = try {
        input.read(buf, off, n - off)
      } catch (_: Exception) {
        return false
      }
      if (r < 0) return false
      off += r
    }
    return true
  }

  private fun handleControl(json: String) {
    val resp: JSONObject = try {
      val req = JSONObject(json)
      val id = req.getInt("id")
      val op = req.getString("op")
      val args = req.optJSONObject("args") ?: JSONObject()
      val handler = ControlBus.service
      if (handler == null) {
        JSONObject().put("id", id).put("ok", false).put("error", "control service not enabled")
      } else {
        try {
          val result = handler.execute(op, args)
          JSONObject().put("id", id).put("ok", true).put("result", result ?: JSONObject.NULL)
        } catch (e: Exception) {
          JSONObject().put("id", id).put("ok", false).put("error", e.message ?: "error")
        }
      }
    } catch (e: Exception) {
      JSONObject().put("id", -1).put("ok", false).put("error", "bad request")
    }
    writeFrame(Protocol.CH_CONTROL, 0, resp.toString().toByteArray(Charsets.UTF_8))
  }

  private fun writeFrame(channel: Int, type: Int, data: ByteArray) {
    val o = out ?: return
    try {
      synchronized(writeLock) {
        o.write(Protocol.header(data.size, channel, type))
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

  /** Write a video access unit on channel 0. */
  fun sendFrame(data: ByteArray, isConfig: Boolean, isKey: Boolean) {
    if (isConfig) lastConfig = data
    val flags = (if (isKey) Protocol.FLAG_KEYFRAME else 0) or (if (isConfig) Protocol.FLAG_CONFIG else 0)
    writeFrame(Protocol.CH_VIDEO, flags, data)
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
