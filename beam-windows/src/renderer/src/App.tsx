import React, { useEffect, useRef, useState } from 'react'
import { Connect } from './screens/Connect'
import { Mirror } from './screens/Mirror'
import { addRecent } from './connect-store'
import { onFramePort } from './frame-port'
import { BeamDecoder } from './decoder'
import type { ConnectionStatus, ConnectOptions } from '../../shared/protocol'

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>({ phase: 'idle' })
  const [active, setActive] = useState(false) // user-initiated live session
  const [demo, setDemo] = useState(false)
  const [port, setPort] = useState<MessagePort | null>(null)
  const lastOpts = useRef<ConnectOptions | null>(null)

  useEffect(() => window.beam.onStatus(setStatus), [])
  useEffect(() => onFramePort(setPort), [])

  // Remember a device once it identifies itself via HELLO.
  useEffect(() => {
    if (status.phase === 'streaming' && status.hello && lastOpts.current) {
      addRecent({
        host: lastOpts.current.host,
        port: lastOpts.current.port,
        device: status.hello.device,
        at: Date.now()
      })
    }
  }, [status.phase, status.hello])

  const handleConnect = (opts: ConnectOptions): void => {
    lastOpts.current = opts
    setActive(true)
    void window.beam.connect(opts)
  }

  const handleDisconnect = (): void => {
    void window.beam.disconnect()
    setActive(false)
    setDemo(false)
  }

  if (demo) {
    return <Mirror mode="demo" status={{ phase: 'idle' }} port={null} onDisconnect={handleDisconnect} />
  }
  if (active) {
    return <Mirror mode="live" status={status} port={port} onDisconnect={handleDisconnect} />
  }
  return (
    <Connect
      onConnect={handleConnect}
      onSelfTest={() => {
        if (!BeamDecoder.isSupported()) {
          setStatus({ phase: 'error', message: 'WebCodecs unavailable in this build.' })
          return
        }
        setDemo(true)
      }}
      error={status.phase === 'error' ? status.message : undefined}
    />
  )
}
