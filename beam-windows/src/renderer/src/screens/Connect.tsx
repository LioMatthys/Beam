import React, { useState } from 'react'
import { GradientButton } from '../components/GradientButton'
import { DEFAULT_PORT } from '../../../shared/protocol'
import type { ConnectOptions } from '../../../shared/protocol'
import { loadRecents } from '../connect-store'
import { QRCodeSVG } from 'qrcode.react'
import logo from '../assets/logo.png'

// Stable GitHub URL that 302-redirects to the latest release's Beam.apk asset, so the
// QR keeps working across future releases without regenerating it.
const APK_QR_URL = 'https://github.com/LioMatthys/Beam/releases/latest/download/Beam.apk'

interface Props {
  onConnect: (opts: ConnectOptions) => void
  error?: string
}

export function Connect({ onConnect, error }: Props): React.JSX.Element {
  const [host, setHost] = useState('')
  const [port, setPort] = useState(String(DEFAULT_PORT))
  const [code, setCode] = useState('')
  const recents = loadRecents()

  const [installMsg, setInstallMsg] = useState('')
  const [installing, setInstalling] = useState(false)
  const [showQr, setShowQr] = useState(true)
  const [showUsb, setShowUsb] = useState(false)

  const installAndroid = async (): Promise<void> => {
    setInstalling(true)
    setInstallMsg('Starting…')
    const off = window.beam.android.onProgress((p) =>
      setInstallMsg(p.percent != null ? `${p.message} ${p.percent}%` : p.message)
    )
    const r = await window.beam.android.install()
    off()
    setInstalling(false)
    if (!r.ok) setInstallMsg(`⚠ ${r.error}`)
  }

  const portNum = Number(port)
  const valid = host.trim().length > 0 && Number.isInteger(portNum) && portNum > 0 && portNum < 65536

  const submit = (): void => {
    if (!valid) return
    onConnect({ host: host.trim(), port: portNum, code: code.trim() })
  }

  return (
    <div className="screen">
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img src={logo} width={72} height={72} alt="Beam" style={{ marginBottom: 8 }} />
        <div className="eyebrow">Receiver</div>
        <div className="title">
          <span className="brand-mark">Beam</span>
        </div>
      </div>

      <div className="card">
        <label className="field-label">Phone address (IP)</label>
        <input
          className="input"
          inputMode="decimal"
          placeholder="192.168.1.42"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />

        <div className="spacer-sm" />
        <div className="row">
          <div style={{ width: 120 }}>
            <label className="field-label">Port</label>
            <input className="input" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Code (6 digits)</label>
            <input
              className="input mono"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        <div className="spacer-md" />
        <GradientButton label="Connect" onClick={submit} disabled={!valid} />

        {error && (
          <>
            <div className="spacer-sm" />
            <div className="error-text">{error}</div>
          </>
        )}

        {recents.length > 0 && (
          <>
            <div className="spacer-md" />
            <label className="field-label">Recent</label>
            {recents.map((r) => (
              <button
                key={`${r.host}:${r.port}`}
                className="tbtn"
                style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}
                onClick={() => {
                  setHost(r.host)
                  setPort(String(r.port))
                }}
              >
                {r.device ? `${r.device} — ` : ''}
                {r.host}:{r.port}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="spacer-md" />
      <div className="card" style={{ maxWidth: 420 }}>
        <label className="field-label">First time? Install on the phone</label>
        <p className="hint" style={{ marginBottom: 12 }}>
          Scan this with your phone’s camera to download Beam, then open the file and tap to
          install (allow “install unknown apps” if asked).
        </p>

        {showQr && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              justifyContent: 'center'
            }}>
            <QRCodeSVG value={APK_QR_URL} size={196} bgColor="#ffffff" fgColor="#0f0f14" level="M" />
          </div>
        )}

        <div className="spacer-sm" />
        <button className="tbtn" style={{ width: '100%' }} onClick={() => setShowQr((v) => !v)}>
          {showQr ? 'Hide QR code' : 'Show install QR code'}
        </button>

        <div className="spacer-sm" />
        {!showUsb ? (
          <button
            className="tbtn"
            style={{ width: '100%', opacity: 0.7, fontWeight: 600 }}
            onClick={() => setShowUsb(true)}>
            Advanced: install via USB
          </button>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 8 }}>
              Connect the phone by USB (with USB debugging on) — Beam installs and opens it
              automatically.
            </p>
            <button
              className="tbtn"
              style={{ width: '100%' }}
              onClick={installAndroid}
              disabled={installing}>
              {installing ? 'Working…' : 'Install on Android (USB)'}
            </button>
            {installMsg && (
              <div className="hint" style={{ marginTop: 10 }}>
                {installMsg}
              </div>
            )}
          </>
        )}
      </div>

      <div className="spacer-md" />
      <p className="hint" style={{ maxWidth: 420, textAlign: 'center' }}>
        On the phone, open Beam and tap “Start sharing.” The IP address and code to enter here
        will appear on its screen.
      </p>
    </div>
  )
}
