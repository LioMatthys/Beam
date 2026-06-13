import React from 'react'
import type { ConnectionPhase } from '../../../shared/protocol'

const MAP: Record<ConnectionPhase, { cls: string; label: string }> = {
  idle: { cls: '', label: 'Offline' },
  connecting: { cls: 'warn', label: 'Connecting…' },
  handshaking: { cls: 'warn', label: 'Pairing…' },
  streaming: { cls: 'live', label: 'Live' },
  reconnecting: { cls: 'warn', label: 'Reconnecting…' },
  error: { cls: 'err', label: 'Error' }
}

export function StatusPill({ phase }: { phase: ConnectionPhase }): React.JSX.Element {
  const m = MAP[phase]
  return (
    <span className={`pill ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  )
}
