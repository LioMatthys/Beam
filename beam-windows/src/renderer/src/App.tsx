import React, { useEffect, useRef, useState } from 'react'
import { Connect } from './screens/Connect'
import { Mirror } from './screens/Mirror'
import { addRecent, forgetCode } from './connect-store'
import { onFramePort } from './frame-port'
import type { ConnectionStatus, ConnectOptions } from '../../shared/protocol'

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>({ phase: 'idle' })
  const [active, setActive] = useState(false) // user-initiated live session
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
        code: lastOpts.current.code,
        at: Date.now()
      })
    }
  }, [status.phase, status.hello])

  // A terminal error: stop the session and return to Connect. If the phone rejected the
  // code, forget the stored one so the next attempt pairs fresh (no silent retry loop).
  useEffect(() => {
    if (status.phase === 'error' && status.fatal) {
      if (status.reason === 'auth' && lastOpts.current) {
        forgetCode(lastOpts.current.host, lastOpts.current.port)
      }
      setActive(false)
    }
  }, [status.phase, status.fatal, status.reason])

  const handleConnect = (opts: ConnectOptions): void => {
    lastOpts.current = opts
    setActive(true)
    void window.beam.connect(opts)
  }

  const handleDisconnect = (): void => {
    void window.beam.disconnect()
    setActive(false)
  }

  if (active) {
    return (
      <Mirror
        status={status}
        port={port}
        host={lastOpts.current?.host}
        onDisconnect={handleDisconnect}
      />
    )
  }
  return (
    <Connect
      onConnect={handleConnect}
      error={status.phase === 'error' ? status.message : undefined}
    />
  )
}
