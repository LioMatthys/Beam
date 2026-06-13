import React, { useEffect, useRef, useState } from 'react'
import { BeamDecoder } from '../decoder'
import { runDecoderSelfTest, type DemoHandle } from '../demo'
import { StatusPill } from '../components/StatusPill'
import type { ConnectionStatus } from '../../../shared/protocol'

interface Props {
  mode: 'live' | 'demo'
  status: ConnectionStatus
  port: MessagePort | null
  onDisconnect: () => void
}

export function Mirror({ mode, status, port, onDisconnect }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const decoderRef = useRef<BeamDecoder | null>(null)
  const demoRef = useRef<DemoHandle | null>(null)

  const [fps, setFps] = useState(0)
  const [decErr, setDecErr] = useState<string | undefined>()
  const [stretch, setStretch] = useState(false)

  // Persistent frame-channel handler: routes incoming frames to whatever decoder
  // is currently active. Decoupled from decoder lifetime so reconnects are seamless.
  useEffect(() => {
    if (!port) return
    const handler = (e: MessageEvent): void => {
      const d = decoderRef.current
      if (d && e.data) d.push(e.data.flags, e.data.data)
    }
    port.onmessage = handler
    port.start()
    return () => {
      port.onmessage = null
    }
  }, [port])

  // Live decoder: (re)create when a stream becomes active.
  useEffect(() => {
    if (mode !== 'live') return
    if (status.phase === 'streaming' && status.hello && canvasRef.current) {
      const d = new BeamDecoder(canvasRef.current)
      d.setOnStats(setFps)
      d.setOnError(setDecErr)
      d.start(status.hello)
      decoderRef.current = d
      setDecErr(undefined)
      return () => {
        d.stop()
        decoderRef.current = null
        setFps(0)
      }
    }
    return undefined
  }, [mode, status.phase, status.hello])

  // Demo: local encode→decode loopback.
  useEffect(() => {
    if (mode !== 'demo' || !canvasRef.current) return
    const h = runDecoderSelfTest(canvasRef.current, setFps, setDecErr)
    demoRef.current = h
    return () => {
      h.stop()
      demoRef.current = null
      setFps(0)
    }
  }, [mode])

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void mirrorRef.current?.requestFullscreen()
  }

  const deviceName = mode === 'demo' ? 'Local demo' : (status.hello?.device ?? 'Phone')
  const res = status.hello ? `${status.hello.width}×${status.hello.height}` : ''
  const waiting = mode === 'live' && status.phase !== 'streaming'

  return (
    <div className="app">
      <div className="topbar">
        <span className="device">{deviceName}</span>
        {mode === 'live' ? <StatusPill phase={status.phase} /> : <span className="pill live"><span className="dot" />Demo</span>}
        <span className="grow" />
        {res && <span className="stat">{res}</span>}
        <span className="stat">{fps} fps</span>
        <button className="tbtn" onClick={() => setStretch((s) => !s)}>
          {stretch ? 'Fit' : 'Stretch'}
        </button>
        <button className="tbtn" onClick={toggleFullscreen}>
          Fullscreen
        </button>
        <button className="tbtn danger" onClick={onDisconnect}>
          {mode === 'demo' ? 'Close' : 'Disconnect'}
        </button>
      </div>

      <div className={`mirror ${stretch ? 'stretch' : ''}`} ref={mirrorRef}>
        <canvas ref={canvasRef} />
        {waiting && (
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div className="waiting">
              {status.phase === 'error'
                ? (status.message ?? 'Connection error')
                : status.phase === 'reconnecting'
                  ? 'Reconnecting to phone…'
                  : 'Connecting to phone…'}
            </div>
          </div>
        )}
        {decErr && !waiting && (
          <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
            <span className="pill err">
              <span className="dot" />
              {decErr}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
