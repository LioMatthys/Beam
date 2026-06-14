import React, { useEffect, useRef, useState } from 'react'
import { BeamDecoder } from '../decoder'
import { StatusPill } from '../components/StatusPill'
import type { ConnectionStatus } from '../../../shared/protocol'

interface Props {
  status: ConnectionStatus
  port: MessagePort | null
  onDisconnect: () => void
}

export function Mirror({ status, port, onDisconnect }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const decoderRef = useRef<BeamDecoder | null>(null)

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

  // Decoder: (re)create when a stream becomes active.
  useEffect(() => {
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
  }, [status.phase, status.hello])

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void mirrorRef.current?.requestFullscreen()
  }

  const controllable = !!status.hello && status.hello.channels?.includes('control')

  // Click-to-act: map a click on the cast to physical phone pixels and send a tap.
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const hello = status.hello
    const canvas = canvasRef.current
    if (!controllable || !hello || !canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const cw = canvas.width || hello.width
    const ch = canvas.height || hello.height
    let ix: number
    let iy: number
    if (stretch) {
      ix = (e.clientX - rect.left) / rect.width
      iy = (e.clientY - rect.top) / rect.height
    } else {
      // object-fit: contain — find the letterboxed image rect inside the element
      const imgAspect = cw / ch
      const boxAspect = rect.width / rect.height
      let dispW = rect.width
      let dispH = rect.height
      let offX = 0
      let offY = 0
      if (boxAspect > imgAspect) {
        dispW = rect.height * imgAspect
        offX = (rect.width - dispW) / 2
      } else {
        dispH = rect.width / imgAspect
        offY = (rect.height - dispH) / 2
      }
      ix = (e.clientX - rect.left - offX) / dispW
      iy = (e.clientY - rect.top - offY) / dispH
    }
    if (ix < 0 || ix > 1 || iy < 0 || iy > 1) return
    void window.beam.control('tap', {
      x: Math.round(ix * hello.physWidth),
      y: Math.round(iy * hello.physHeight)
    })
  }

  const deviceName = status.hello?.device ?? 'Phone'
  const res = status.hello ? `${status.hello.width}×${status.hello.height}` : ''
  const waiting = status.phase !== 'streaming'

  return (
    <div className="app">
      <div className="topbar">
        <span className="device">{deviceName}</span>
        <StatusPill phase={status.phase} />
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
          Disconnect
        </button>
      </div>

      <div className={`mirror ${stretch ? 'stretch' : ''}`} ref={mirrorRef}>
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          style={{ cursor: controllable ? 'crosshair' : 'default' }}
        />
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
